from rest_framework import generics, views, status
from rest_framework.response import Response
from django.db.models import Sum, Count, Q, Avg
from django.utils import timezone
from .models import Trade, MTAccount
from .serializers import TradeSerializer, MTAccountSerializer, DashboardStatsSerializer
from .csv_service import parse_mt5_csv
from .metaapi_service import sync_fetch_trades
import threading


class TradeListView(generics.ListCreateAPIView):
    serializer_class = TradeSerializer

    def get_queryset(self):
        qs = Trade.objects.filter(user=self.request.user)
        symbol = self.request.query_params.get('symbol')
        trade_type = self.request.query_params.get('type')
        date_from = self.request.query_params.get('from')
        date_to = self.request.query_params.get('to')
        if symbol:
            qs = qs.filter(symbol__icontains=symbol)
        if trade_type:
            qs = qs.filter(trade_type=trade_type.upper())
        if date_from:
            qs = qs.filter(open_time__date__gte=date_from)
        if date_to:
            qs = qs.filter(open_time__date__lte=date_to)
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class TradeDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TradeSerializer

    def get_queryset(self):
        return Trade.objects.filter(user=self.request.user)


class DashboardStatsView(views.APIView):
    def get(self, request):
        trades = Trade.objects.filter(user=request.user, close_time__isnull=False)

        total = trades.count()
        if total == 0:
            return Response({
                'total_trades': 0, 'winning_trades': 0, 'losing_trades': 0,
                'win_rate': 0, 'total_profit': 0, 'avg_profit': 0,
                'avg_loss': 0, 'profit_factor': 0, 'best_trade': 0,
                'worst_trade': 0, 'equity_curve': [],
            })

        winners = trades.filter(profit__gt=0)
        losers = trades.filter(profit__lte=0)

        total_profit = trades.aggregate(s=Sum('profit'))['s'] or 0
        gross_profit = winners.aggregate(s=Sum('profit'))['s'] or 0
        gross_loss = abs(losers.aggregate(s=Sum('profit'))['s'] or 0)

        avg_profit = winners.aggregate(a=Avg('profit'))['a'] or 0
        avg_loss = losers.aggregate(a=Avg('profit'))['a'] or 0

        profit_factor = round(gross_profit / gross_loss, 2) if gross_loss > 0 else 0

        profits = list(trades.order_by('close_time').values_list('profit', flat=True))
        running = 0
        equity_curve = []
        for p in profits:
            running += float(p or 0)
            equity_curve.append(round(running, 2))

        best = trades.order_by('-profit').first()
        worst = trades.order_by('profit').first()

        return Response({
            'total_trades': total,
            'winning_trades': winners.count(),
            'losing_trades': losers.count(),
            'win_rate': round(winners.count() / total * 100, 1),
            'total_profit': round(float(total_profit), 2),
            'avg_profit': round(float(avg_profit), 2),
            'avg_loss': round(float(avg_loss), 2),
            'profit_factor': profit_factor,
            'best_trade': round(float(best.profit), 2) if best else 0,
            'worst_trade': round(float(worst.profit), 2) if worst else 0,
            'equity_curve': equity_curve,
        })


class CSVImportView(views.APIView):
    def post(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            trades_data = parse_mt5_csv(file)
        except Exception as e:
            return Response({'error': f'Failed to parse CSV: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        created = 0
        skipped = 0
        for t in trades_data:
            _, was_created = Trade.objects.get_or_create(
                user=request.user,
                ticket=t['ticket'],
                mt_account=None,
                defaults={**t},
            )
            if was_created:
                created += 1
            else:
                skipped += 1

        return Response({'imported': created, 'skipped': skipped})


class MT5ImportView(views.APIView):
    def post(self, request):
        mt_login = request.data.get('login')
        mt_password = request.data.get('password')
        mt_server = request.data.get('server')

        if not all([mt_login, mt_password, mt_server]):
            return Response(
                {'error': 'login, password, and server are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            trades_data = sync_fetch_trades(mt_login, mt_password, mt_server)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_502_BAD_GATEWAY)

        mt_account, _ = MTAccount.objects.get_or_create(
            user=request.user,
            login=str(mt_login),
            server=mt_server,
            defaults={'label': f'{mt_login}@{mt_server}'},
        )
        mt_account.last_synced = timezone.now()
        mt_account.save()

        created = 0
        skipped = 0
        for t in trades_data:
            ticket = t.pop('ticket', '')
            _, was_created = Trade.objects.get_or_create(
                user=request.user,
                ticket=ticket,
                mt_account=mt_account,
                defaults={**t},
            )
            if was_created:
                created += 1
            else:
                skipped += 1

        return Response({'imported': created, 'skipped': skipped})


class MTAccountListView(generics.ListAPIView):
    serializer_class = MTAccountSerializer

    def get_queryset(self):
        return MTAccount.objects.filter(user=self.request.user)


class JSONImportView(views.APIView):
    def post(self, request):
        trades_raw = request.data.get('trades')
        if not trades_raw or not isinstance(trades_raw, list):
            return Response({'error': 'Send { "trades": [...] }'}, status=status.HTTP_400_BAD_REQUEST)

        from datetime import datetime
        import hashlib

        def parse_dt(s):
            if not s:
                return None
            for fmt in ('%d.%m.%Y %H:%M', '%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S'):
                try:
                    return datetime.strptime(s.strip(), fmt)
                except ValueError:
                    continue
            return None

        def infer_type(open_price, close_price, profit):
            try:
                diff = float(close_price) - float(open_price)
                pnl  = float(profit)
                if diff == 0:
                    return 'BUY'
                # BUY profits when price goes up, SELL profits when price goes down
                return 'BUY' if (diff * pnl) >= 0 else 'SELL'
            except Exception:
                return 'BUY'

        created = skipped = errors = 0

        for row in trades_raw:
            try:
                symbol      = row.get('symbol', '').replace('.vxc', '').strip()
                open_time   = parse_dt(row.get('open_time', ''))
                close_time  = parse_dt(row.get('close_time', ''))
                open_price  = row.get('open_price', 0)
                close_price = row.get('close_price', 0)
                profit      = row.get('profit', 0)
                volume      = row.get('volume', 0)
                trade_type  = row.get('type', '').upper() or infer_type(open_price, close_price, profit)

                if not symbol or not open_time:
                    errors += 1
                    continue

                # Stable unique ticket: hash of symbol + open_time + open_price
                raw = f"{symbol}{open_time}{open_price}"
                ticket = hashlib.md5(raw.encode()).hexdigest()[:16]

                _, was_created = Trade.objects.get_or_create(
                    user=request.user,
                    ticket=ticket,
                    mt_account=None,
                    defaults={
                        'symbol':      symbol,
                        'trade_type':  trade_type,
                        'volume':      float(volume),
                        'open_price':  float(open_price),
                        'close_price': float(close_price) if close_price else None,
                        'open_time':   open_time,
                        'close_time':  close_time,
                        'profit':      float(profit) if profit != '' else None,
                    }
                )
                if was_created:
                    created += 1
                else:
                    skipped += 1
            except Exception:
                errors += 1

        return Response({'imported': created, 'skipped': skipped, 'errors': errors})

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from trades.models import Trade
from journal.models import JournalEntry
from .gemini_agents import analyse_trades, auto_journal_trades
from django.conf import settings


class AnalysisRunView(APIView):
    def post(self, request):
        trades = Trade.objects.filter(
            user=request.user,
            close_time__isnull=False
        ).values(
            'id', 'symbol', 'trade_type', 'volume',
            'open_price', 'close_price', 'open_time',
            'close_time', 'profit', 'strategy_tag',
        )

        journal_entries = JournalEntry.objects.filter(
            user=request.user
        ).values(
            'trade_id', 'notes', 'emotion', 'mistake', 'rating'
        )

        # Rename trade_id → trade to match build_trade_summary
        journal_list = [
            {**j, 'trade': j.pop('trade_id')}
            for j in journal_entries
        ]

        trades_list = list(trades)

        if len(trades_list) < 3:
            return Response(
                {'error': 'You need at least 3 closed trades to run analysis.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            results = analyse_trades(trades_list, journal_list)
            return Response({'agents': results})
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_502_BAD_GATEWAY
            )


class AutoJournalView(APIView):
    def post(self, request):
        trades = list(Trade.objects.filter(
            user=request.user,
            close_time__isnull=False,
        ).values(
            'id', 'symbol', 'trade_type', 'volume',
            'open_price', 'close_price', 'open_time',
            'close_time', 'profit', 'strategy_tag',
        ))

        if not trades:
            return Response({'error': 'No closed trades found.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            entries = auto_journal_trades(trades)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_502_BAD_GATEWAY)

        created = updated = errors = 0
        for entry in entries:
            try:
                trade_id = entry.get('trade_id')
                if not trade_id:
                    errors += 1
                    continue

                from journal.models import JournalEntry
                obj, was_created = JournalEntry.objects.update_or_create(
                    trade_id=trade_id,
                    user=request.user,
                    defaults={
                        'notes':   entry.get('notes', ''),
                        'emotion': entry.get('emotion', ''),
                        'mistake': entry.get('mistake', ''),
                        'rating':  entry.get('rating') or None,
                    }
                )
                if was_created:
                    created += 1
                else:
                    updated += 1
            except Exception:
                errors += 1

        return Response({'created': created, 'updated': updated, 'errors': errors})


class TranscribeView(APIView):
    def post(self, request):
        audio_file = request.FILES.get('audio')
        if not audio_file:
            return Response({'error': 'No audio file'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=settings.GEMINI_API_KEY)

            audio_bytes = audio_file.read()

            response = client.models.generate_content(
                model='gemini-2.5-flash-lite',
                contents=[
                    types.Part.from_bytes(data=audio_bytes, mime_type='audio/webm'),
                    'Transcribe this trading journal voice note exactly as spoken. Return only the transcription, no commentary.',
                ]
            )
            return Response({'text': response.text.strip()})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_502_BAD_GATEWAY)

from rest_framework import serializers
from .models import Trade, MTAccount


class MTAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = MTAccount
        fields = ('id', 'login', 'server', 'label', 'last_synced', 'created_at')
        read_only_fields = ('metaapi_account_id', 'last_synced', 'created_at')


class TradeSerializer(serializers.ModelSerializer):
    net_profit = serializers.ReadOnlyField()
    is_winner = serializers.ReadOnlyField()
    journal_entry = serializers.SerializerMethodField()

    class Meta:
        model = Trade
        fields = (
            'id', 'ticket', 'symbol', 'trade_type', 'volume',
            'open_price', 'close_price', 'stop_loss', 'take_profit',
            'open_time', 'close_time', 'profit', 'commission', 'swap',
            'net_profit', 'is_winner', 'strategy_tag', 'journal_entry',
            'created_at',
        )
        read_only_fields = ('created_at',)

    def get_journal_entry(self, obj):
        if hasattr(obj, 'journal_entry'):
            from journal.serializers import JournalEntrySerializer
            return JournalEntrySerializer(obj.journal_entry).data
        return None


class DashboardStatsSerializer(serializers.Serializer):
    total_trades = serializers.IntegerField()
    winning_trades = serializers.IntegerField()
    losing_trades = serializers.IntegerField()
    win_rate = serializers.FloatField()
    total_profit = serializers.FloatField()
    avg_profit = serializers.FloatField()
    avg_loss = serializers.FloatField()
    profit_factor = serializers.FloatField()
    best_trade = serializers.FloatField()
    worst_trade = serializers.FloatField()
    equity_curve = serializers.ListField()

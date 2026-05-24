from django.db import models
from django.conf import settings


class MTAccount(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='mt_accounts')
    login = models.CharField(max_length=50)
    server = models.CharField(max_length=100)
    metaapi_account_id = models.CharField(max_length=100, blank=True)
    label = models.CharField(max_length=100, blank=True)
    last_synced = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'login', 'server')

    def __str__(self):
        return f"{self.login}@{self.server}"


class Trade(models.Model):
    TRADE_TYPES = [
        ('BUY', 'Buy'),
        ('SELL', 'Sell'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='trades')
    mt_account = models.ForeignKey(MTAccount, on_delete=models.SET_NULL, null=True, blank=True)

    ticket = models.CharField(max_length=50, blank=True)
    symbol = models.CharField(max_length=20)
    trade_type = models.CharField(max_length=4, choices=TRADE_TYPES)
    volume = models.DecimalField(max_digits=10, decimal_places=2)

    open_price = models.DecimalField(max_digits=15, decimal_places=5)
    close_price = models.DecimalField(max_digits=15, decimal_places=5, null=True, blank=True)
    stop_loss = models.DecimalField(max_digits=15, decimal_places=5, null=True, blank=True)
    take_profit = models.DecimalField(max_digits=15, decimal_places=5, null=True, blank=True)

    open_time = models.DateTimeField()
    close_time = models.DateTimeField(null=True, blank=True)

    profit = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    commission = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    swap = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    strategy_tag = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-open_time']
        unique_together = ('user', 'ticket', 'mt_account')

    def __str__(self):
        return f"{self.trade_type} {self.symbol} {self.volume} lots"

    @property
    def net_profit(self):
        if self.profit is None:
            return None
        return float(self.profit) + float(self.commission) + float(self.swap)

    @property
    def is_winner(self):
        if self.net_profit is None:
            return None
        return self.net_profit > 0

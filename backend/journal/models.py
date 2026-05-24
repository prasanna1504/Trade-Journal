from django.db import models
from django.conf import settings


class JournalEntry(models.Model):
    EMOTION_CHOICES = [
        ('disciplined', 'Disciplined'),
        ('fomo', 'FOMO'),
        ('revenge', 'Revenge Trade'),
        ('patient', 'Patient'),
        ('greedy', 'Greedy'),
        ('fearful', 'Fearful'),
        ('confident', 'Confident'),
    ]

    MISTAKE_CHOICES = [
        ('early_exit', 'Exited Too Early'),
        ('late_exit', 'Exited Too Late'),
        ('oversized', 'Position Too Large'),
        ('no_plan', 'No Plan'),
        ('moved_sl', 'Moved Stop Loss'),
        ('chased', 'Chased Entry'),
        ('none', 'No Mistake'),
    ]

    trade = models.OneToOneField(
        'trades.Trade', on_delete=models.CASCADE, related_name='journal_entry'
    )
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    notes = models.TextField(blank=True)
    emotion = models.CharField(max_length=20, choices=EMOTION_CHOICES, blank=True)
    mistake = models.CharField(max_length=20, choices=MISTAKE_CHOICES, blank=True)
    screenshot = models.ImageField(upload_to='screenshots/', null=True, blank=True)
    rating = models.PositiveSmallIntegerField(null=True, blank=True)  # 1-5

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Journal for trade {self.trade_id}"

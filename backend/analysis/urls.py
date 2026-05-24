from django.urls import path
from .views import AnalysisRunView, AutoJournalView, TranscribeView

urlpatterns = [
    path('run/', AnalysisRunView.as_view()),
    path('auto-journal/', AutoJournalView.as_view()),
    path('transcribe/', TranscribeView.as_view()),
]

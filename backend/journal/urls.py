from django.urls import path
from .views import JournalEntryListCreateView, JournalEntryDetailView

urlpatterns = [
    path('', JournalEntryListCreateView.as_view()),
    path('<int:pk>/', JournalEntryDetailView.as_view()),
]

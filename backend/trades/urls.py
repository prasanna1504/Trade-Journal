from django.urls import path
from .views import (
    TradeListView, TradeDetailView, DashboardStatsView,
    CSVImportView, MT5ImportView, MTAccountListView, JSONImportView,
)

urlpatterns = [
    path('', TradeListView.as_view()),
    path('<int:pk>/', TradeDetailView.as_view()),
    path('stats/', DashboardStatsView.as_view()),
    path('import/csv/', CSVImportView.as_view()),
    path('import/mt5/', MT5ImportView.as_view()),
    path('accounts/', MTAccountListView.as_view()),
    path('import/json/', JSONImportView.as_view()),
]

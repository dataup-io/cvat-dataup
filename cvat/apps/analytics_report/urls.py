from django.urls import path
from .views import GetClassDistributionView

urlpatterns = [
    path("analytics/class_distribution/", GetClassDistributionView.as_view(), name="class_distribution"),
]

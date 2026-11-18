from django.urls import path
from .views import CurrentUserView, RegisterView, LoginView, LogoutView, CSRFTokenView

urlpatterns = [
    path('csrf/', CSRFTokenView.as_view(), name='csrf'),
    path('me/', CurrentUserView.as_view(), name='current-user'),
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
]

from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import login, logout
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator
from .models import User
from .serializers import UserSerializer, RegisterSerializer, LoginSerializer

@method_decorator(ensure_csrf_cookie, name='dispatch')
class CSRFTokenView(APIView):
    """
    Returns the CSRF token in JSON and sets the CSRF cookie on the client response.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({'csrfToken': get_token(request)}, status=status.HTTP_200_OK)


class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response({'authenticated': True, 'user': serializer.data}, status=status.HTTP_200_OK)

    def patch(self, request):
        user = request.user
        data = request.data

        if 'first_name' in data:
            user.first_name = data['first_name']
        if 'last_name' in data:
            user.last_name = data['last_name']
        if 'phone_number' in data:
            user.phone_number = data['phone_number']
        user.save()

        from .models import StudentProfile
        profile, _ = StudentProfile.objects.get_or_create(user=user)
        if 'target_exam' in data:
            profile.target_exam = data['target_exam']
        if 'target_year' in data:
            try:
                profile.target_year = int(data['target_year'])
            except (ValueError, TypeError):
                pass
        if 'bio' in data:
            profile.bio = data['bio']
        profile.save()

        serializer = UserSerializer(user)
        return Response({'message': 'Profile updated successfully', 'user': serializer.data}, status=status.HTTP_200_OK)


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'register'

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            login(request, user)
            user_data = UserSerializer(user).data
            return Response({'message': 'Registration successful', 'user': user_data}, status=status.HTTP_201_CREATED)
        return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'login'

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            login(request, user)

            remember_me = serializer.validated_data.get('remember_me', False)
            if remember_me:
                # 2 weeks
                request.session.set_expiry(1209600)
            else:
                # Browser session
                request.session.set_expiry(0)

            user_data = UserSerializer(user).data
            response = Response({'message': 'Login successful', 'user': user_data}, status=status.HTTP_200_OK)
            
            # Non-HttpOnly cookie for Next.js Edge middleware routing
            max_age = 1209600 if remember_me else None
            response.set_cookie('user_role', user.role, max_age=max_age, samesite='Lax', secure=False, httponly=False)
            response.set_cookie('auth_session', '1', max_age=max_age, samesite='Lax', secure=False, httponly=False)
            return response
        return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        logout(request)
        response = Response({'message': 'Logout successful'}, status=status.HTTP_200_OK)
        response.delete_cookie('user_role')
        response.delete_cookie('auth_session')
        response.delete_cookie('sessionid')
        return response

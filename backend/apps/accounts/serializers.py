from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import User, StudentProfile

class StudentProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentProfile
        fields = ['target_exam', 'target_year', 'avatar_url', 'bio']

class UserSerializer(serializers.ModelSerializer):
    student_profile = StudentProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'username', 'first_name', 'last_name', 'role', 'phone_number', 'is_verified', 'student_profile']
        read_only_fields = ['id', 'is_verified']

class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=6)
    first_name = serializers.CharField(required=False, allow_blank=True, default='')
    last_name = serializers.CharField(required=False, allow_blank=True, default='')
    phone_number = serializers.CharField(required=False, allow_blank=True, default='')
    target_exam = serializers.CharField(required=False, default='BOTH')
    target_year = serializers.IntegerField(required=False, default=2025)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()

    def create(self, validated_data):
        target_exam = validated_data.pop('target_exam', 'BOTH')
        target_year = validated_data.pop('target_year', 2025)
        password = validated_data.pop('password')
        
        email = validated_data['email']
        username = email.split('@')[0]
        
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            phone_number=validated_data.get('phone_number', '')
        )
        
        StudentProfile.objects.create(
            user=user,
            target_exam=target_exam,
            target_year=target_year
        )
        return user

class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        email = data.get('email', '').lower()
        password = data.get('password', '')

        if not email or not password:
            raise serializers.ValidationError("Both email and password are required.")

        user = authenticate(username=email, password=password)
        if not user:
            # Fallback check if authenticated via email directly
            try:
                u = User.objects.get(email__iexact=email)
                if u.check_password(password):
                    user = u
            except User.DoesNotExist:
                pass

        if not user:
            raise serializers.ValidationError("Invalid email or password.")
        if not user.is_active:
            raise serializers.ValidationError("User account is disabled.")

        data['user'] = user
        return data

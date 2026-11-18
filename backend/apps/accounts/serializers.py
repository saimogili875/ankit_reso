from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from .models import User, StudentProfile

class StudentProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentProfile
        fields = ['target_exam', 'target_year', 'avatar_url', 'bio']

class UserSerializer(serializers.ModelSerializer):
    student_profile = StudentProfileSerializer(read_only=True)
    is_admin = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'email', 'username', 'first_name', 'last_name',
            'role', 'phone_number', 'is_verified', 'is_admin', 'student_profile'
        ]
        read_only_fields = ['id', 'is_verified', 'is_admin']

    def get_is_admin(self, obj):
        return bool(obj.role == User.Role.ADMIN or obj.is_superuser)

class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(required=False, allow_blank=True, default='')
    last_name = serializers.CharField(required=False, allow_blank=True, default='')
    phone_number = serializers.CharField(required=False, allow_blank=True, default='')
    target_exam = serializers.CharField(required=False, default='BOTH')
    target_year = serializers.IntegerField(required=False, default=2025)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()

    def validate_password(self, value):
        validate_password(value)
        return value

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
    email = serializers.CharField(required=False, allow_blank=True)
    identifier = serializers.CharField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True)
    portal = serializers.ChoiceField(choices=['student', 'admin'], default='student', required=False)
    remember_me = serializers.BooleanField(default=False, required=False)

    def validate(self, data):
        identifier = (data.get('identifier') or data.get('email') or '').strip()
        password = data.get('password', '')
        portal = data.get('portal', 'student').lower()

        if not identifier or not password:
            raise serializers.ValidationError("Both username/email and password are required.")

        GENERIC_ERROR = "Invalid credentials. Please check your username and password."

        user = None
        if '@' in identifier:
            user = User.objects.filter(email__iexact=identifier).first()
        else:
            phone_matches = User.objects.filter(phone_number=identifier)
            count = phone_matches.count()
            if count > 1:
                raise serializers.ValidationError("Multiple accounts found with this phone number. Please use your email to log in.")
            elif count == 1:
                user = phone_matches.first()
            else:
                user = User.objects.filter(username__iexact=identifier).first()

        if not user or not user.check_password(password):
            raise serializers.ValidationError(GENERIC_ERROR)

        if not user.is_active:
            raise serializers.ValidationError("User account is disabled.")

        is_admin_user = (user.role == User.Role.ADMIN or user.is_superuser)

        if portal == 'admin':
            if not is_admin_user:
                raise serializers.ValidationError(GENERIC_ERROR)
        elif portal == 'student':
            if is_admin_user:
                raise serializers.ValidationError("Use Admin login")

        data['user'] = user
        return data

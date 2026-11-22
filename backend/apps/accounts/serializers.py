import re
from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.core.signing import TimestampSigner, BadSignature, SignatureExpired
from .models import User, StudentProfile, normalize_phone
from .otp import OTPService, TOKEN_MAX_AGE_SECONDS

class StudentProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentProfile
        fields = [
            'academic_class', 'target_exam', 'target_year',
            'city', 'state', 'school_or_coaching',
            'preferred_language', 'contact_phone', 'is_onboarded',
            'avatar_url', 'bio'
        ]

class UserSerializer(serializers.ModelSerializer):
    student_profile = StudentProfileSerializer(read_only=True)
    is_admin = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'clerk_id', 'email', 'username', 'full_name', 'first_name', 'last_name',
            'role', 'phone', 'phone_number', 'is_verified', 'is_email_verified',
            'is_phone_verified', 'is_admin', 'student_profile'
        ]
        read_only_fields = ['id', 'clerk_id', 'is_verified', 'is_email_verified', 'is_phone_verified', 'is_admin']

    def get_is_admin(self, obj):
        return bool(str(obj.role).upper() == User.Role.ADMIN or obj.is_superuser or obj.is_staff)


class StudentOnboardingSerializer(serializers.Serializer):
    academic_class = serializers.CharField(max_length=20, required=False, default='12')
    target_exam = serializers.CharField(max_length=20, required=False, default='BOTH')
    target_year = serializers.IntegerField(required=False, default=2025)
    city = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    state = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    school_or_coaching = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')
    preferred_language = serializers.CharField(max_length=50, required=False, allow_blank=True, default='English')
    contact_phone = serializers.CharField(max_length=20, required=False, allow_blank=True, default='')

    def validate_contact_phone(self, value):
        if not value:
            return ""
        val = value.strip()
        digits = re.sub(r'\D', '', val)
        if digits and len(digits) != 10:
            raise serializers.ValidationError("Please provide a valid 10-digit mobile number.")
        return digits



# --- OTP Serializers ---

class SendEmailOtpSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        email_clean = value.strip().lower()
        if User.objects.filter(email__iexact=email_clean).exists():
            raise serializers.ValidationError("An account with this email address already exists.")
        return email_clean

class VerifyEmailOtpSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(min_length=6, max_length=6)

    def validate_email(self, value):
        return value.strip().lower()

    def validate_otp(self, value):
        return value.strip()


class SendPhoneOtpSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=20)

    def validate_phone(self, value):
        norm = normalize_phone(value.strip())
        digits = re.sub(r'\D', '', norm)
        if len(digits) < 10 or len(digits) > 13:
            raise serializers.ValidationError("Please provide a valid 10-digit mobile number.")
        if User.objects.filter(phone=norm).exists() or User.objects.filter(phone_number=norm).exists():
            raise serializers.ValidationError("An account with this mobile number already exists.")
        return norm

class VerifyPhoneOtpSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=20)
    otp = serializers.CharField(min_length=6, max_length=6)

    def validate_phone(self, value):
        return normalize_phone(value.strip())

    def validate_otp(self, value):
        return value.strip()


# --- Signup Serializer ---

class SignupSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=255)
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=20)
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)
    email_token = serializers.CharField()
    phone_token = serializers.CharField()
    target_exam = serializers.CharField(required=False, default='BOTH')
    target_year = serializers.IntegerField(required=False, default=2025)

    def validate_username(self, value):
        username = value.strip()
        if not re.match(r'^[a-zA-Z0-9_.-]+$', username):
            raise serializers.ValidationError("Username may only contain letters, numbers, and ./-/_ characters.")
        if User.objects.filter(username__iexact=username).exists():
            raise serializers.ValidationError("This username is already taken. Please choose another.")
        return username

    def validate_email(self, value):
        email_clean = value.strip().lower()
        if User.objects.filter(email__iexact=email_clean).exists():
            raise serializers.ValidationError("An account with this email address already exists.")
        return email_clean

    def validate_phone(self, value):
        norm = normalize_phone(value.strip())
        digits = re.sub(r'\D', '', norm)
        if len(digits) < 10:
            raise serializers.ValidationError("Please provide a valid 10-digit mobile number.")
        if User.objects.filter(phone=norm).exists() or User.objects.filter(phone_number=norm).exists():
            raise serializers.ValidationError("An account with this mobile number already exists.")
        return norm

    def validate(self, data):
        # 1. Password confirmation & validation
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        validate_password(data['password'])

        # 2. Token validations
        email = data['email']
        phone = data['phone']

        if not OTPService.validate_verification_token(data['email_token'], email, "signup_email"):
            raise serializers.ValidationError({"email_token": "Email verification token is invalid or expired. Please re-verify your email."})

        if not OTPService.validate_verification_token(data['phone_token'], phone, "signup_phone"):
            raise serializers.ValidationError({"phone_token": "Mobile verification token is invalid or expired. Please re-verify your mobile number."})

        return data

    def create(self, validated_data):
        email = validated_data['email']
        username = validated_data['username']
        phone = validated_data['phone']
        full_name = validated_data['full_name']
        password = validated_data['password']
        target_exam = validated_data.get('target_exam', 'BOTH')
        target_year = validated_data.get('target_year', 2025)

        parts = full_name.split(' ', 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ''

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            full_name=full_name,
            first_name=first_name,
            last_name=last_name,
            phone=phone,
            phone_number=phone,
            role=User.Role.STUDENT,
            is_email_verified=True,
            is_phone_verified=True,
            is_verified=True,
        )

        StudentProfile.objects.create(
            user=user,
            target_exam=target_exam,
            target_year=target_year
        )
        return user


# --- Legacy RegisterSerializer (Backward compatibility) ---

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


# --- Login Serializer (Identifier: Email, Phone, or Username) ---

class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField(required=False, allow_blank=True)
    email = serializers.CharField(required=False, allow_blank=True) # fallback field name
    password = serializers.CharField(write_only=True)
    portal = serializers.ChoiceField(choices=['student', 'admin'], default='student', required=False)
    remember_me = serializers.BooleanField(default=False, required=False)

    def validate(self, data):
        identifier = (data.get('identifier') or data.get('email') or '').strip()
        password = data.get('password', '')
        portal = data.get('portal', 'student').lower()

        GENERIC_ERROR = "Invalid credentials. Please check your username and password."

        if not identifier or not password:
            raise serializers.ValidationError(GENERIC_ERROR)

        user = None
        # Detect identifier type:
        # 1. Contains '@' -> Email
        if '@' in identifier:
            user = User.objects.select_related('student_profile').filter(email__iexact=identifier).first()
        # 2. Starts with '+' or is all digits -> Phone
        elif identifier.startswith('+') or identifier.replace('-', '').replace(' ', '').isdigit():
            norm_phone = normalize_phone(identifier)
            user = User.objects.select_related('student_profile').filter(phone=norm_phone).first() or User.objects.select_related('student_profile').filter(phone_number=norm_phone).first()
        # 3. Otherwise -> Username
        else:
            user = User.objects.select_related('student_profile').filter(username__iexact=identifier).first()

        if not user or not user.check_password(password):
            raise serializers.ValidationError(GENERIC_ERROR)

        if not user.is_active:
            raise serializers.ValidationError("User account is disabled. Please contact support.")

        is_admin_user = (str(user.role).upper() == User.Role.ADMIN or user.is_superuser or user.is_staff)

        if portal == 'admin':
            if not is_admin_user:
                raise serializers.ValidationError(GENERIC_ERROR)
            if user.role != User.Role.ADMIN or not user.is_staff:
                user.role = User.Role.ADMIN
                user.is_staff = True
                user.save(update_fields=['role', 'is_staff'])
        elif portal == 'student':
            if is_admin_user:
                raise serializers.ValidationError("Use Admin login")

        data['user'] = user
        return data


# --- Password Reset Serializers ---

class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return value.strip().lower()

class VerifyResetOtpSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(min_length=6, max_length=6)

    def validate_email(self, value):
        return value.strip().lower()

    def validate_otp(self, value):
        return value.strip()

class ResetPasswordSerializer(serializers.Serializer):
    reset_token = serializers.CharField()
    new_password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        validate_password(data['new_password'])
        return data


# --- Profile Update Serializer ---

class UpdateProfileSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=255, required=False)
    username = serializers.CharField(max_length=150, required=False)
    email = serializers.EmailField(required=False)
    email_token = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(max_length=20, required=False)
    phone_token = serializers.CharField(required=False, allow_blank=True)
    target_exam = serializers.CharField(required=False)
    target_year = serializers.IntegerField(required=False)
    bio = serializers.CharField(required=False, allow_blank=True)

    def validate_username(self, value):
        user = self.context['request'].user
        value = value.strip()
        if not re.match(r'^[a-zA-Z0-9_.-]+$', value):
            raise serializers.ValidationError("Username may only contain letters, numbers, and ./-/_ characters.")
        if User.objects.filter(username__iexact=value).exclude(id=user.id).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate(self, data):
        user = self.context['request'].user

        # If changing email, verify email_token
        if 'email' in data and data['email'].strip().lower() != user.email.lower():
            new_email = data['email'].strip().lower()
            if User.objects.filter(email__iexact=new_email).exclude(id=user.id).exists():
                raise serializers.ValidationError({"email": "This email address is already in use."})
            token = data.get('email_token')
            if not token or not OTPService.validate_verification_token(token, new_email, "change_email"):
                raise serializers.ValidationError({"email_token": "Email verification code is required to change email."})

        # If changing phone, verify phone_token
        if 'phone' in data:
            new_phone = normalize_phone(data['phone'].strip())
            if new_phone != user.phone:
                if User.objects.filter(phone=new_phone).exclude(id=user.id).exists():
                    raise serializers.ValidationError({"phone": "This mobile number is already registered to another account."})
                token = data.get('phone_token')
                if not token or not OTPService.validate_verification_token(token, new_phone, "change_phone"):
                    raise serializers.ValidationError({"phone_token": "Mobile verification code is required to change mobile number."})

        return data

from django.db import migrations
from django.contrib.auth.hashers import make_password

def seed_admin_user(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    email = 'ankit@adepteduverse.com'
    password = 'Ank@247shbm'
    username = 'ankit'
    
    hashed_password = make_password(password)

    user = User.objects.filter(email__iexact=email).first()
    if not user:
        user = User.objects.filter(username__iexact=username).first()

    if user:
        user.email = email
        user.username = username
        user.role = 'ADMIN'
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.is_verified = True
        user.is_email_verified = True
        user.password = hashed_password
        user.save()
    else:
        User.objects.create(
            email=email,
            username=username,
            role='ADMIN',
            first_name='Ankit',
            last_name='Admin',
            is_staff=True,
            is_superuser=True,
            is_active=True,
            is_verified=True,
            is_email_verified=True,
            password=hashed_password,
        )

def remove_admin_user(apps, schema_editor):
    pass

class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_user_full_name_user_is_email_verified_and_more'),
    ]

    operations = [
        migrations.RunPython(seed_admin_user, remove_admin_user),
    ]

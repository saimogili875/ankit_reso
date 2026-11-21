from django.db import migrations

def noop(apps, schema_editor):
    """
    Migration 0003 previously hardcoded administrative credentials.
    In accordance with Security Audit Item S1, this migration has been neutralized into a no-op
    to prevent hardcoded secrets in version control and to avoid resetting user passwords on migrate.
    Administrative superusers are now provisioned via environment variables using `ensure_admin`.
    """
    pass

class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_user_full_name_user_is_email_verified_and_more'),
    ]

    operations = [
        migrations.RunPython(noop, noop),
    ]


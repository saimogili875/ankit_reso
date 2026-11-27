import django.db.models.deletion
from django.db import migrations, models


def migrate_entitlements_and_payments(apps, schema_editor):
    Payment = apps.get_model('payments', 'Payment')
    Entitlement = apps.get_model('payments', 'Entitlement')
    Course = apps.get_model('academics', 'Course')

    for ent in Entitlement.objects.all():
        if not ent.course_id and ent.batch_id:
            batch = ent.batch
            if batch and batch.course_id:
                ent.course_id = batch.course_id
                ent.save(update_fields=['course'])

    for pay in Payment.objects.filter(course__isnull=True):
        if pay.batch_id:
            batch = pay.batch
            if batch and batch.course_id:
                pay.course_id = batch.course_id
                pay.save(update_fields=['course'])


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0007_coursecategory_course_fields_coursefeature_courseaddon'),
        ('payments', '0005_entitlement'),
    ]

    operations = [
        migrations.AddField(
            model_name='entitlement',
            name='course',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='entitlements', to='academics.course'),
        ),
        migrations.AddField(
            model_name='entitlement',
            name='course_addon',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='entitlements', to='academics.courseaddon'),
        ),
        migrations.AlterField(
            model_name='payment',
            name='items_snapshot',
            field=models.JSONField(blank=True, default=list, help_text='Snapshot of selected course and add-ons at purchase time'),
        ),
        migrations.RunPython(migrate_entitlements_and_payments, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='payment',
            name='batch',
        ),
        migrations.RemoveField(
            model_name='entitlement',
            name='batch',
        ),
        migrations.RemoveField(
            model_name='entitlement',
            name='batch_item',
        ),
    ]

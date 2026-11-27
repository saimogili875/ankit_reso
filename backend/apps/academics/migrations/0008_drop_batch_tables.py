from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0007_coursecategory_course_fields_coursefeature_courseaddon'),
        ('payments', '0006_update_payment_entitlement_for_course_only'),
    ]

    operations = [
        migrations.DeleteModel(
            name='BatchItem',
        ),
        migrations.DeleteModel(
            name='BatchFeature',
        ),
        migrations.DeleteModel(
            name='Batch',
        ),
        migrations.DeleteModel(
            name='PricingCard',
        ),
    ]

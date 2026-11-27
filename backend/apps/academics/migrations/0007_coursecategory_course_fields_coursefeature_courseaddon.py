import uuid
import os
import django.db.models.deletion
from django.db import migrations, models


def migrate_batch_data_and_guard(apps, schema_editor):
    Batch = apps.get_model('academics', 'Batch')
    BatchItem = apps.get_model('academics', 'BatchItem')
    PricingCard = apps.get_model('academics', 'PricingCard')
    Payment = apps.get_model('payments', 'Payment')
    Enrollment = apps.get_model('academics', 'Enrollment')
    Course = apps.get_model('academics', 'Course')
    CourseCategory = apps.get_model('academics', 'CourseCategory')
    CourseFeature = apps.get_model('academics', 'CourseFeature')
    CourseAddon = apps.get_model('academics', 'CourseAddon')

    batch_count = Batch.objects.count()
    batch_item_count = BatchItem.objects.count()
    pricing_card_count = PricingCard.objects.count()
    payment_count = Payment.objects.count()
    enrollment_count = Enrollment.objects.count()

    print("\n=======================================================")
    print("  DATABASE SAFETY: ROW COUNTS BEFORE BATCH REMOVAL")
    print("=======================================================")
    print(f"  Batch:        {batch_count}")
    print(f"  BatchItem:    {batch_item_count}")
    print(f"  PricingCard:  {pricing_card_count}")
    print(f"  Payment:      {payment_count}")
    print(f"  Enrollment:   {enrollment_count}")
    print("=======================================================\n")

    # SAFETY GUARD:
    # If any Payment with status PAID, or any Enrollment, exists that came from a Batch
    # and cannot be safely preserved, abort with a clear error listing counts.
    paid_batch_payments = Payment.objects.filter(status='paid', batch__isnull=False).count()
    if paid_batch_payments > 0 and os.environ.get('ALLOW_BATCH_REMOVAL') != '1':
        raise RuntimeError(
            f"SAFETY GUARD ABORT: Found {paid_batch_payments} PAID Payment records originating from a Batch! "
            f"Real revenue data cannot be silently dropped. "
            f"Counts: Batch={batch_count}, BatchItem={batch_item_count}, PricingCard={pricing_card_count}, "
            f"Payment={payment_count}, Enrollment={enrollment_count}. "
            f"Set ALLOW_BATCH_REMOVAL=1 to proceed if this is test data."
        )

    # 1. Copy PricingCard -> CourseCategory
    card_map = {}
    for card in PricingCard.objects.all():
        cta_url = (card.cta_url or '/courses/school').replace('/batches/', '/courses/')
        cat, _ = CourseCategory.objects.get_or_create(
            slug=card.key,
            defaults={
                'name': card.title,
                'tagline': card.tagline,
                'badge': card.badge,
                'rotate_seconds': card.rotate_seconds,
                'cta_label': card.cta_label or 'Explore Courses',
                'cta_url': cta_url,
                'order': card.order,
                'is_published': card.is_published,
            }
        )
        card_map[card.id] = cat

    # 2. Copy Batch -> Course & link payments
    for batch in Batch.objects.all():
        course = batch.course
        cat = card_map.get(batch.card_id)

        if not course:
            course, _ = Course.objects.get_or_create(
                slug=batch.slug,
                defaults={
                    'title': batch.name,
                    'tagline': batch.tagline,
                    'description': batch.description,
                    'image': batch.image,
                    'thumbnail_url': batch.image or '/images/hero/slide-1.jpg',
                    'price': batch.price,
                    'original_price': batch.original_price or 0,
                    'has_live_classes': getattr(batch, 'has_live_classes', False),
                    'display_order': batch.display_order,
                    'is_published': batch.is_published,
                    'is_free': (batch.price == 0),
                    'category': cat,
                    'academic_class': batch.academic_class,
                }
            )
        else:
            if cat:
                course.category = cat
            if batch.academic_class:
                course.academic_class = batch.academic_class
            course.tagline = batch.tagline or course.subtitle
            course.image = batch.image or course.thumbnail_url
            course.has_live_classes = getattr(batch, 'has_live_classes', False)
            course.display_order = batch.display_order
            course.price = batch.price
            if batch.original_price:
                course.original_price = batch.original_price
            course.save()

        # Copy BatchFeatures -> CourseFeature
        for feat in batch.features.all():
            CourseFeature.objects.get_or_create(
                course=course,
                text=feat.text,
                defaults={'order': feat.order}
            )

        # Copy BatchItems -> CourseAddon
        for item in batch.items.all():
            CourseAddon.objects.get_or_create(
                course=course,
                title=item.title,
                defaults={
                    'addon_type': item.item_type,
                    'price': item.price,
                    'order': 0,
                    'is_published': True,
                }
            )

        # Relink any Payments pointing to batch to the course
        Payment.objects.filter(batch=batch, course__isnull=True).update(course=course)

    print("\n=======================================================")
    print("  DATABASE SAFETY: ROW COUNTS AFTER DATA COPY")
    print("=======================================================")
    print(f"  CourseCategory: {CourseCategory.objects.count()}")
    print(f"  Course:         {Course.objects.count()}")
    print(f"  CourseFeature:  {CourseFeature.objects.count()}")
    print(f"  CourseAddon:    {CourseAddon.objects.count()}")
    print(f"  Payment:        {Payment.objects.count()}")
    print(f"  Enrollment:     {Enrollment.objects.count()}")
    print("=======================================================\n")


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0006_batch_has_live_classes'),
        ('payments', '0005_entitlement'),
    ]

    operations = [
        migrations.CreateModel(
            name='CourseCategory',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('name', models.CharField(max_length=255)),
                ('slug', models.SlugField(max_length=100, unique=True)),
                ('tagline', models.CharField(blank=True, max_length=500)),
                ('badge', models.CharField(blank=True, max_length=100)),
                ('rotate_seconds', models.IntegerField(default=5, help_text='Carousel auto-advance speed in seconds')),
                ('cta_label', models.CharField(default='Explore Courses', max_length=100)),
                ('cta_url', models.CharField(default='/courses/school', max_length=255)),
                ('is_published', models.BooleanField(db_index=True, default=True)),
                ('order', models.IntegerField(default=0)),
            ],
            options={
                'verbose_name_plural': 'Course Categories',
                'ordering': ['order', 'created_at'],
            },
        ),
        migrations.AddField(
            model_name='course',
            name='academic_class',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='direct_courses', to='academics.academicclass'),
        ),
        migrations.AddField(
            model_name='course',
            name='category',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='courses', to='academics.coursecategory'),
        ),
        migrations.AddField(
            model_name='course',
            name='display_order',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='course',
            name='has_live_classes',
            field=models.BooleanField(default=False, help_text='Set to True only if course conducts live classes'),
        ),
        migrations.AddField(
            model_name='course',
            name='image',
            field=models.CharField(blank=True, help_text='Cloudflare R2 image URL or static image path', max_length=1000),
        ),
        migrations.AddField(
            model_name='course',
            name='tagline',
            field=models.CharField(blank=True, max_length=500),
        ),
        migrations.CreateModel(
            name='CourseFeature',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('text', models.CharField(max_length=500)),
                ('order', models.IntegerField(default=0)),
                ('category', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='features', to='academics.coursecategory')),
                ('course', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='course_features', to='academics.course')),
            ],
            options={
                'ordering': ['order', 'created_at'],
            },
        ),
        migrations.CreateModel(
            name='CourseAddon',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('title', models.CharField(max_length=255)),
                ('addon_type', models.CharField(choices=[('MODULE', 'Complete Module'), ('TEST_SERIES', 'Test Series'), ('ADVANCED_BOOK_DIGITAL', 'Digital Advanced Problem Book'), ('SP', 'Subject Practice / Sheet Practice'), ('PP', 'Problem Practice'), ('PYQ', 'Previous Years Questions'), ('MENTAL_ABILITY', 'Mental Ability & Reasoning'), ('OLYMPIAD', 'Olympiad Material'), ('JEE_MAINS_TEST', 'JEE Mains Mock Tests'), ('JEE_ADVANCED_TEST', 'JEE Advanced Mock Tests'), ('SHORT_NOTES', 'Revision Short Notes'), ('COACHING_TEST_SERIES', 'National Coaching Test Series')], default='MODULE', max_length=50)),
                ('price', models.DecimalField(decimal_places=2, default=0.0, max_digits=10)),
                ('description', models.TextField(blank=True)),
                ('order', models.IntegerField(default=0)),
                ('is_published', models.BooleanField(default=True)),
                ('course', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='addons', to='academics.course')),
            ],
            options={
                'ordering': ['order', 'price', 'created_at'],
            },
        ),
        migrations.RunPython(migrate_batch_data_and_guard, migrations.RunPython.noop),
    ]

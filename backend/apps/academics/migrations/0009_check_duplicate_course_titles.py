from django.db import migrations
from django.db.models import Count

def report_duplicate_course_titles(apps, schema_editor):
    Course = apps.get_model('academics', 'Course')
    # Find duplicates grouping by title
    duplicates = (
        Course.objects.values('title')
        .annotate(title_count=Count('id'))
        .filter(title_count__gt=1)
    )
    if duplicates.exists():
        print("\n=======================================================")
        print("  DATA SAFETY: DUPLICATE COURSE TITLES DETECTED")
        print("=======================================================")
        for dup in duplicates:
            title = dup['title']
            courses = Course.objects.filter(title__iexact=title)
            print(f"  Title '{title}' appears {dup['title_count']} times:")
            for c in courses:
                print(f"    - ID: {c.id}, Slug: {c.slug}, Created: {c.created_at}")
        print("=======================================================\n")
    else:
        print("\n[Data Safety] Verified: No duplicate course titles detected.")

class Migration(migrations.Migration):
    dependencies = [
        ('academics', '0008_drop_batch_tables'),
    ]

    operations = [
        migrations.RunPython(report_duplicate_course_titles, reverse_code=migrations.RunPython.noop),
    ]

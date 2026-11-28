import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0009_check_duplicate_course_titles'),
    ]

    operations = [
        # 1. Exam additions
        migrations.AddField(
            model_name='exam',
            name='order',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='exam',
            name='is_active',
            field=models.BooleanField(default=True),
        ),
        migrations.AlterModelOptions(
            name='exam',
            options={'ordering': ['order', 'name']},
        ),

        # 2. AcademicClass: add nullable exam, remove global unique on name/slug/code
        migrations.AddField(
            model_name='academicclass',
            name='exam',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='classes',
                to='academics.exam'
            ),
        ),
        migrations.AlterField(
            model_name='academicclass',
            name='name',
            field=models.CharField(max_length=50),
        ),
        migrations.AlterField(
            model_name='academicclass',
            name='slug',
            field=models.SlugField(max_length=50),
        ),
        migrations.AlterField(
            model_name='academicclass',
            name='code',
            field=models.CharField(max_length=20),
        ),

        # 3. Subject: add nullable academic_class, remove global unique on name/slug
        migrations.AddField(
            model_name='subject',
            name='academic_class',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='subjects',
                to='academics.academicclass'
            ),
        ),
        migrations.AlterField(
            model_name='subject',
            name='name',
            field=models.CharField(max_length=100),
        ),
        migrations.AlterField(
            model_name='subject',
            name='slug',
            field=models.SlugField(max_length=100),
        ),

        # 4. Chapter: add nullable direct subject FK, make category nullable
        migrations.AddField(
            model_name='chapter',
            name='subject',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='chapters',
                to='academics.subject'
            ),
        ),
        migrations.AlterField(
            model_name='chapter',
            name='category',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='chapters',
                to='academics.category'
            ),
        ),

        # 5. Course: add nullable exam FK
        migrations.AddField(
            model_name='course',
            name='exam',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='courses',
                to='academics.exam'
            ),
        ),
    ]

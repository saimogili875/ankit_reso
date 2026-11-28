import django.db.models.deletion
from django.db import migrations, models
from django.db.models.functions import Lower


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0011_academic_hierarchy_data'),
    ]

    operations = [
        # 1. Enforce AcademicClass.exam non-null + composite constraints
        migrations.AlterField(
            model_name='academicclass',
            name='exam',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='classes',
                to='academics.exam'
            ),
        ),
        migrations.AddConstraint(
            model_name='academicclass',
            constraint=models.UniqueConstraint(fields=['exam', 'slug'], name='unique_exam_class_slug'),
        ),
        migrations.AddConstraint(
            model_name='academicclass',
            constraint=models.UniqueConstraint(fields=['exam', 'code'], name='unique_exam_class_code'),
        ),
        migrations.AddConstraint(
            model_name='academicclass',
            constraint=models.UniqueConstraint(Lower('name'), 'exam', name='unique_exam_class_name'),
        ),

        # 2. Enforce Subject.academic_class non-null + composite constraints
        migrations.AlterField(
            model_name='subject',
            name='academic_class',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='subjects',
                to='academics.academicclass'
            ),
        ),
        migrations.AddConstraint(
            model_name='subject',
            constraint=models.UniqueConstraint(fields=['academic_class', 'slug'], name='unique_class_subject_slug'),
        ),
        migrations.AddConstraint(
            model_name='subject',
            constraint=models.UniqueConstraint(Lower('name'), 'academic_class', name='unique_class_subject_name'),
        ),

        # 3. Category composite constraint
        migrations.AddConstraint(
            model_name='category',
            constraint=models.UniqueConstraint(fields=['subject', 'slug'], name='unique_subject_category_slug'),
        ),

        # 4. Enforce Chapter.subject non-null + composite constraints
        migrations.AlterField(
            model_name='chapter',
            name='subject',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='chapters',
                to='academics.subject'
            ),
        ),
        migrations.AddConstraint(
            model_name='chapter',
            constraint=models.UniqueConstraint(fields=['subject', 'slug'], name='unique_subject_chapter_slug'),
        ),
        migrations.AddConstraint(
            model_name='chapter',
            constraint=models.UniqueConstraint(fields=['subject', 'name'], name='unique_subject_chapter_name'),
        ),

        migrations.AlterModelOptions(
            name='chapter',
            options={'ordering': ['order', 'name']},
        ),
        # 5. Remove legacy fields: Chapter.academic_class and Course.exam_type
        migrations.RemoveField(
            model_name='chapter',
            name='academic_class',
        ),
        migrations.RemoveField(
            model_name='course',
            name='exam_type',
        ),
    ]

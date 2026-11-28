from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('questions', '0003_question_ideal_time_seconds_and_more'),
    ]

    operations = [
        migrations.AddConstraint(
            model_name='dpp',
            constraint=models.UniqueConstraint(fields=['chapter', 'dpp_number'], name='unique_chapter_dpp_number'),
        ),
    ]

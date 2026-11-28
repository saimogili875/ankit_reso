from django.db import migrations


def forward_hierarchy_migration(apps, schema_editor):
    from apps.academics.management.commands.migrate_academic_hierarchy import run_hierarchy_migration
    run_hierarchy_migration(stdout=None, dry_run=False)


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0010_academic_hierarchy_prep'),
    ]

    operations = [
        migrations.RunPython(forward_hierarchy_migration, reverse_code=migrations.RunPython.noop),
    ]

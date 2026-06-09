from django.db import migrations, models
from django.db.models import Q


def dedupe_system_names(apps, schema_editor):
    System = apps.get_model('api', 'System')
    from collections import defaultdict
    buckets = defaultdict(list)
    for s in System.objects.filter(is_deleted=False).only('id', 'owner_id', 'name'):
        buckets[(s.owner_id, s.name)].append(s.id)
    for (_owner_id, name), ids in buckets.items():
        if len(ids) <= 1:
            continue
        for sid in sorted(ids)[1:]:
            s = System.objects.get(pk=sid)
            s.name = f"{name} ({sid})"
            s.save(update_fields=['name'])


class Migration(migrations.Migration):
    dependencies = [
        ('api', '0002_user_expertise_level'),
    ]

    operations = [
        migrations.RunPython(dedupe_system_names, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='system',
            constraint=models.UniqueConstraint(
                condition=Q(is_deleted=False),
                fields=('owner', 'name'),
                name='uniq_system_owner_name_active',
            ),
        ),
    ]

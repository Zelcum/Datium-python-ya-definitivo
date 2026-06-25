from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0005_systemfield_is_auto_increment'),
    ]

    operations = [
        # 1. Make Plan.name unique (remove existing duplicates first if needed)
        migrations.AlterField(
            model_name='plan',
            name='name',
            field=models.CharField(max_length=50, unique=True),
        ),

        # 2. Expand AuditLog with auditing fields
        migrations.AddField(
            model_name='auditlog',
            name='table_name',
            field=models.CharField(blank=True, max_length=200, null=True),
        ),
        migrations.AddField(
            model_name='auditlog',
            name='record_id',
            field=models.BigIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='auditlog',
            name='status',
            field=models.CharField(
                choices=[('success', 'Éxito'), ('error', 'Error')],
                default='success',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='auditlog',
            name='error_message',
            field=models.TextField(blank=True, null=True),
        ),
        # Expand ip field to 100 chars to accommodate IPv6
        migrations.AlterField(
            model_name='auditlog',
            name='ip',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
    ]

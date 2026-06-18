from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0004_systemfield_is_primary_key'),
    ]

    operations = [
        migrations.AddField(
            model_name='systemfield',
            name='is_auto_increment',
            field=models.BooleanField(default=False),
        ),
    ]

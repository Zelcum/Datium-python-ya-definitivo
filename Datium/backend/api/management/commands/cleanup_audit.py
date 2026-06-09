from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from api.models import AuditLog, SecurityAudit

class Command(BaseCommand):
    help = 'Elimina registros de auditoría y seguridad con más de 60 días de antigüedad.'

    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(days=60)
        
        # Auditoría de actividad
        count_audit = AuditLog.objects.filter(created_at__lt=cutoff).delete()[0]
        
        # Auditoría de seguridad
        count_sec = SecurityAudit.objects.filter(created_at__lt=cutoff).delete()[0]
        
        self.stdout.write(self.style.SUCCESS(
            f'Limpieza completada: {count_audit} registros de auditoría y {count_sec} de seguridad eliminados.'
        ))

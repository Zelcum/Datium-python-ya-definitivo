import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Datium.settings')
django.setup()

from api.models import (
    User, Plan, System, SystemTable, SystemField, SystemRecord, 
    AuditLog, SecurityAudit, UserReport, BlockedIP, AppSetting,
    SystemCollaborator, SystemToken, SystemInvitation, Discount, Payment
)
from django.contrib.auth.hashers import make_password

def clear_and_seed():
    print("Limpiando datos...")
    
    # Keep only admins and default plans
    # 1. Clear transactional data (cascade will handle most)
    System.objects.all().delete()
    AuditLog.objects.all().delete()
    SecurityAudit.objects.all().delete()
    UserReport.objects.all().delete()
    BlockedIP.objects.all().delete()
    SystemCollaborator.objects.all().delete()
    SystemToken.objects.all().delete()
    SystemInvitation.objects.all().delete()
    Discount.objects.all().delete()
    Payment.objects.all().delete()
    
    # 2. Clear Users except admins
    User.objects.exclude(role='admin').delete()
    
    # 3. Ensure Plans exist
    plans_data = [
        {'name': 'Gratis', 'price_monthly': 0, 'max_systems': 2, 'max_tables_per_system': 5, 'max_records_per_table': 100, 'has_ai': False, 'storage_limit_mb': 50},
        {'name': 'Pro', 'price_monthly': 19, 'max_systems': 10, 'max_tables_per_system': 20, 'max_records_per_table': 5000, 'has_ai': True, 'storage_limit_mb': 500},
        {'name': 'Enterprise', 'price_monthly': 99, 'max_systems': 100, 'max_tables_per_system': 100, 'max_records_per_table': 100000, 'has_ai': True, 'storage_limit_mb': 5000},
    ]
    
    for pd in plans_data:
        plan, created = Plan.objects.get_or_create(name=pd['name'], defaults=pd)
        if not created:
            for key, value in pd.items():
                setattr(plan, key, value)
            plan.save()
            
    # 4. Ensure at least one Admin exists if none
    if not User.objects.filter(role='admin').exists():
        admin_pass = "admin123" # Default, user should change this
        User.objects.create(
            email="admin@datium.com",
            name="Admin Datium",
            password_hash=make_password(admin_pass),
            role="admin",
            plan=Plan.objects.get(name='Enterprise')
        )
        print(f"Admin creado: admin@datium.com / {admin_pass}")
    else:
        print("Admin ya existe.")
        
    print("Datos limpiados y planes default asegurados.")

if __name__ == "__main__":
    clear_and_seed()

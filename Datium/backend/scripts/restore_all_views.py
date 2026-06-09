"""
Restore missing view functions and fix imports in api/views.py.
"""
import os

path = 'api/views.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update imports
old_models_import = """from .models import (
    Plan, User, System, SystemTable, SystemField,
    SystemFieldOption, SystemRecord, SystemRecordValue,
    SystemRelationship, AuditLog, SecurityAudit,
    SystemCollaborator, AppSetting, UserReport, BlockedIP
)"""

new_models_import = """from .models import (
    Plan, User, System, SystemTable, SystemField,
    SystemFieldOption, SystemRecord, SystemRecordValue,
    SystemRelationship, AuditLog, SecurityAudit,
    SystemCollaborator, AppSetting, UserReport, BlockedIP,
    Discount, Payment
)"""

content = content.replace(old_models_import, new_models_import)

# 2. Append missing functions
missing_views = """

# ═══════════════════════════════════════════
# ADDITIONAL VIEWS (RESTORED)
# ═══════════════════════════════════════════

@api_view(['GET', 'POST'])
def admin_discounts_view(request):
    user, err = require_admin(request)
    if err: return err
    if request.method == 'POST':
        code = request.data.get('code')
        percentage = request.data.get('percentage')
        if code and percentage:
            Discount.objects.create(code=code, percentage=percentage)
        return Response({'ok': True})
    discounts = Discount.objects.all().order_by('-created_at')
    return Response([{'id': d.id, 'code': d.code, 'percentage': float(d.percentage), 'is_active': d.is_active} for d in discounts])

@api_view(['PUT', 'DELETE'])
def admin_discount_detail_view(request, pk):
    user, err = require_admin(request)
    if err: return err
    discount = get_object_or_404(Discount, id=pk)
    if request.method == 'DELETE':
        discount.delete()
        return Response({'ok': True})
    discount.code = request.data.get('code', discount.code)
    discount.percentage = request.data.get('percentage', discount.percentage)
    discount.is_active = request.data.get('is_active', discount.is_active)
    discount.save()
    return Response({'ok': True})

@api_view(['GET'])
def admin_payments_view(request):
    user, err = require_admin(request)
    if err: return err
    payments = Payment.objects.all().order_by('-created_at')
    return Response([{
        'id': p.id, 'user': p.user.email if p.user else '', 'amount': float(p.amount), 
        'status': p.status, 'createdAt': p.created_at.isoformat()
    } for p in payments])

@api_view(['POST'])
def process_payment_view(request):
    user, err = require_auth(request)
    if err: return err
    # Stub for payment logic
    return Response({'ok': True, 'message': 'Pago procesado (Simulación)'})

@api_view(['GET'])
def admin_trash_systems_view(request):
    user, err = require_admin(request)
    if err: return err
    systems = System.objects.filter(is_deleted=True)
    return Response([serialize_system(s) for s in systems])

@api_view(['POST'])
def admin_trash_restore_view(request, pk):
    user, err = require_admin(request)
    if err: return err
    system = get_object_or_404(System, id=pk)
    system.is_deleted = False
    system.save()
    return Response({'ok': True})

@api_view(['GET'])
def admin_trash_export_view(request):
    user, err = require_admin(request)
    if err: return err
    # Logic for exporting trash if needed
    return Response({'ok': True, 'message': 'Export completado (Simulación)'})

@api_view(['PUT'])
def update_table_style_view(request, pk):
    user, err = require_auth(request)
    if err: return err
    table = get_object_or_404(SystemTable, id=pk)
    # Check permission
    perms = get_system_permissions(user, table.system)
    if not perms.get('update'):
        return Response({'error': 'Sin permisos'}, status=403)
    table.custom_style_json = json.dumps(request.data.get('style', {}))
    table.save()
    return Response({'ok': True})

@api_view(['POST'])
def accept_terms_view(request):
    user, err = require_auth(request)
    if err: return err
    version = request.data.get('version', 1)
    user.terms_version_accepted = version
    user.save()
    return Response({'ok': True})

@api_view(['PUT'])
def update_security_settings_view(request):
    user, err = require_auth(request)
    if err: return err
    timeout = request.data.get('session_timeout_minutes')
    if timeout is not None:
        user.session_timeout_minutes = int(timeout)
        user.save()
    return Response({'ok': True})
"""

# Only append if not already present
if 'admin_discounts_view' not in content:
    content += missing_views

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Restored missing views and updated imports!")

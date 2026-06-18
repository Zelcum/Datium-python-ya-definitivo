from django.db import models
from django.db.models import Q
import random

def generate_random_id():
    """Generates a unique 10-digit random ID."""
    return random.randint(1000000000, 9999999999)

# =========================================
# PLANS
# =========================================

class Plan(models.Model):
    id = models.BigIntegerField(primary_key=True, default=generate_random_id, editable=False)
    name = models.CharField(max_length=50)
    max_systems = models.IntegerField()
    max_tables_per_system = models.IntegerField(default=3)
    max_records_per_table = models.IntegerField(default=50000)
    max_fields_per_table = models.IntegerField(default=200)
    max_storage_mb = models.IntegerField(default=1024)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    features_json = models.TextField(default='[]')
    is_active = models.BooleanField(default=True)
    has_ai_assistant = models.BooleanField(default=False)

    def __str__(self):
        return self.name


# =========================================
# USERS
# =========================================

class User(models.Model):
    id = models.BigIntegerField(primary_key=True, default=generate_random_id, editable=False)
    name = models.CharField(max_length=100, null=True, blank=True)
    email = models.EmailField(unique=True)
    password_hash = models.TextField()
    avatar_url = models.TextField(null=True, blank=True)
    role = models.CharField(max_length=20, default='user')
    plan = models.ForeignKey(Plan, on_delete=models.SET_NULL, null=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    storage_used_bytes = models.BigIntegerField(default=0)
    is_suspended = models.BooleanField(default=False)
    terms_version_accepted = models.IntegerField(default=0)
    session_timeout_minutes = models.IntegerField(default=0)
    expertise_level = models.CharField(max_length=20, default='beginner')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.email


# =========================================
# SYSTEMS
# =========================================

class System(models.Model):
    id = models.BigIntegerField(primary_key=True, default=generate_random_id, editable=False)
    owner = models.ForeignKey(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    description = models.TextField(null=True, blank=True)
    image_url = models.TextField(null=True, blank=True)
    security_mode = models.CharField(max_length=20, default='none')
    general_password = models.TextField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['owner', 'name'],
                condition=Q(is_deleted=False),
                name='uniq_system_owner_name_active',
            ),
        ]

    def __str__(self):
        return self.name


class SystemCollaborator(models.Model):
    id = models.BigIntegerField(primary_key=True, default=generate_random_id, editable=False)
    system = models.ForeignKey(System, on_delete=models.CASCADE, related_name='collaborators')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    can_read = models.BooleanField(default=True)
    can_create = models.BooleanField(default=False)
    can_update = models.BooleanField(default=False)
    can_delete = models.BooleanField(default=False)

    class Meta:
        unique_together = ('system', 'user')

    def __str__(self):
        return f"{self.user.email} -> {self.system.name}"


# =========================================
# SYSTEM TABLES
# =========================================

class SystemTable(models.Model):
    id = models.BigIntegerField(primary_key=True, default=generate_random_id, editable=False)
    system = models.ForeignKey(System, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    description = models.TextField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False)
    custom_style_json = models.TextField(default='{}') # Table Personalization (Beta)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('system', 'name')

    def __str__(self):
        return self.name


# =========================================
# SYSTEM FIELDS
# =========================================

class SystemField(models.Model):
    id = models.BigIntegerField(primary_key=True, default=generate_random_id, editable=False)

    FIELD_TYPES = [
        ('text', 'Text'),
        ('number', 'Number'),
        ('date', 'Date'),
        ('boolean', 'Boolean'),
        ('select', 'Select'),
        ('relation', 'Relation'),
        ('email', 'Email'),
        ('url', 'URL'),
        ('phone', 'Phone'),
        ('time', 'Time'),
        ('file', 'File'),
    ]

    table = models.ForeignKey(SystemTable, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=20, choices=FIELD_TYPES)
    required = models.BooleanField(default=False)
    is_unique = models.BooleanField(default=False)
    is_primary_key = models.BooleanField(default=False)
    is_auto_increment = models.BooleanField(default=False)
    order_index = models.IntegerField(default=0)
    related_table = models.ForeignKey(SystemTable, on_delete=models.SET_NULL, null=True, blank=True, related_name='related_fields')
    related_display_field = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='display_for_fields')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class SystemFieldOption(models.Model):
    id = models.BigIntegerField(primary_key=True, default=generate_random_id, editable=False)
    field = models.ForeignKey(SystemField, on_delete=models.CASCADE)
    value = models.CharField(max_length=100)

    def __str__(self):
        return self.value


# =========================================
# SYSTEM RECORDS
# =========================================

class SystemRecord(models.Model):
    id = models.BigIntegerField(primary_key=True, default=generate_random_id, editable=False)
    table = models.ForeignKey(SystemTable, on_delete=models.CASCADE)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    is_deleted = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)
    order_index = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)


# =========================================
# RECORD VALUES
# =========================================

class SystemRecordValue(models.Model):
    id = models.BigIntegerField(primary_key=True, default=generate_random_id, editable=False)
    record = models.ForeignKey(SystemRecord, on_delete=models.CASCADE)
    field = models.ForeignKey(SystemField, on_delete=models.CASCADE)
    value = models.TextField(null=True, blank=True)

    class Meta:
        unique_together = ('record', 'field')


# =========================================
# RELATIONSHIPS
# =========================================

class SystemRelationship(models.Model):
    id = models.BigIntegerField(primary_key=True, default=generate_random_id, editable=False)

    RELATION_TYPES = [
        ('one_to_one', 'One to One'),
        ('one_to_many', 'One to Many'),
        ('many_to_many', 'Many to Many'),
    ]

    system = models.ForeignKey(System, on_delete=models.CASCADE)

    from_table = models.ForeignKey(
        SystemTable,
        on_delete=models.CASCADE,
        related_name="relations_from_table"
    )

    from_field = models.ForeignKey(
        SystemField,
        on_delete=models.CASCADE,
        related_name="relations_from_field"
    )

    to_table = models.ForeignKey(
        SystemTable,
        on_delete=models.CASCADE,
        related_name="relations_to_table"
    )

    to_field = models.ForeignKey(
        SystemField,
        on_delete=models.CASCADE,
        related_name="relations_to_field"
    )

    relation_type = models.CharField(
        max_length=20,
        choices=RELATION_TYPES,
        default='many_to_many'
    )


# =========================================
# AUDIT LOGS
# =========================================

class AuditLog(models.Model):
    id = models.BigIntegerField(primary_key=True, default=generate_random_id, editable=False)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    system = models.ForeignKey(System, on_delete=models.CASCADE)
    action = models.CharField(max_length=200)
    details = models.TextField(null=True, blank=True)
    ip = models.CharField(max_length=50, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class SecurityAudit(models.Model):
    id = models.BigIntegerField(primary_key=True, default=generate_random_id, editable=False)

    SEVERITY_LEVELS = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]

    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    system = models.ForeignKey(System, on_delete=models.CASCADE)
    severity = models.CharField(max_length=10, choices=SEVERITY_LEVELS)
    event = models.CharField(max_length=255)
    details = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


# =========================================
# GLOBALS & REPORTS
# =========================================

class AppSetting(models.Model):
    id = models.BigIntegerField(primary_key=True, default=generate_random_id, editable=False)
    key = models.CharField(max_length=100, unique=True)
    value = models.TextField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.key


class UserReport(models.Model):
    id = models.BigIntegerField(primary_key=True, default=generate_random_id, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    summary = models.TextField()
    screenshot_url = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=20, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

class BlockedIP(models.Model):
    id = models.BigIntegerField(primary_key=True, default=generate_random_id, editable=False)
    ip_address = models.CharField(max_length=50, unique=True)
    reason = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.ip_address

# =========================================
# PAYMENTS & SUBSCRIPTIONS
# =========================================

class Discount(models.Model):
    id = models.BigIntegerField(primary_key=True, default=generate_random_id, editable=False)
    code = models.CharField(max_length=50, unique=True)
    percentage = models.DecimalField(max_digits=5, decimal_places=2) 
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.code

class Payment(models.Model):
    id = models.BigIntegerField(primary_key=True, default=generate_random_id, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    plan = models.ForeignKey(Plan, on_delete=models.SET_NULL, null=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, default='completed')
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Pay {self.amount} - {self.user.email}"

# =========================================
# ADVANCED PERMISSIONS
# =========================================

class SystemCollaboratorTable(models.Model):
    id = models.BigIntegerField(primary_key=True, default=generate_random_id, editable=False)
    collaborator = models.ForeignKey(SystemCollaborator, on_delete=models.CASCADE, related_name='table_permissions')
    table = models.ForeignKey(SystemTable, on_delete=models.CASCADE)
    can_read = models.BooleanField(default=True)
    can_create = models.BooleanField(default=False)
    can_update = models.BooleanField(default=False)
    can_delete = models.BooleanField(default=False)

    class Meta:
        unique_together = ('collaborator', 'table')

    def __str__(self):
        return f"{self.collaborator.user.email} -> {self.table.name}"
from rest_framework import serializers
from .models import (
    Plan, User, System, SystemTable, SystemField,
    SystemFieldOption, SystemRecord, SystemRecordValue,
    SystemRelationship, AuditLog, SecurityAudit
)


class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = "__all__"


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = "__all__"


class SystemSerializer(serializers.ModelSerializer):
    class Meta:
        model = System
        fields = "__all__"


class SystemTableSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemTable
        fields = "__all__"


class SystemFieldSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemField
        fields = "__all__"


class SystemFieldOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemFieldOption
        fields = "__all__"


class SystemRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemRecord
        fields = "__all__"


class SystemRecordValueSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemRecordValue
        fields = "__all__"


class SystemRelationshipSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemRelationship
        fields = "__all__"


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = "__all__"


class SecurityAuditSerializer(serializers.ModelSerializer):
    class Meta:
        model = SecurityAudit
        fields = "__all__"
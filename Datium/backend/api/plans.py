from .models import Plan, System, SystemTable, User

STANDARD_PLANS = [
    {
        "name": "Free",
        "price": 0,
        "max_systems": 1,
        "max_tables_per_system": 3,
        "max_storage_mb": 1024,
        "max_fields_per_table": 200,
        "max_records_per_table": 500_000,
        "has_ai_assistant": True,
        "is_active": True,
    },
    {
        "name": "Pro",
        "price": 20,
        "max_systems": 5,
        "max_tables_per_system": 10,
        "max_storage_mb": 1024,
        "max_fields_per_table": 200,
        "max_records_per_table": 500_000,
        "has_ai_assistant": True,
        "is_active": True,
    },
    {
        "name": "Corporate",
        "price": 50,
        "max_systems": 100,
        "max_tables_per_system": 50,
        "max_storage_mb": 1024,
        "max_fields_per_table": 200,
        "max_records_per_table": 2_000_000,
        "has_ai_assistant": True,
        "is_active": True,
    },
]


def sync_plans_into_db():
    if Plan.objects.filter(name="Free").exists():
        return
    for spec in STANDARD_PLANS:
        Plan.objects.update_or_create(
            name=spec["name"],
            defaults={
                "price": spec["price"],
                "max_systems": spec["max_systems"],
                "max_tables_per_system": spec["max_tables_per_system"],
                "max_storage_mb": spec["max_storage_mb"],
                "max_fields_per_table": spec["max_fields_per_table"],
                "max_records_per_table": spec["max_records_per_table"],
                "has_ai_assistant": spec["has_ai_assistant"],
                "is_active": spec["is_active"],
            },
        )


def plan_for_user(user: User):
    sync_plans_into_db()
    if user.plan_id:
        return Plan.objects.filter(pk=user.plan_id).first()
    return Plan.objects.filter(name="Free", is_active=True).first()


def owned_active_systems_count(user: User) -> int:
    return System.objects.filter(owner=user, is_deleted=False).count()


def assert_can_create_system(user: User):
    plan = plan_for_user(user)
    if not plan:
        raise ValueError("No hay plan disponible.")
    if owned_active_systems_count(user) >= plan.max_systems:
        raise ValueError(
            f"Has alcanzado el límite de {plan.max_systems} sistema(s) del plan {plan.name}. "
            f"Actualiza a Pro o Corporate para crear más."
        )


def assert_can_add_table(system: System):
    plan = plan_for_user(system.owner)
    if not plan:
        raise ValueError("Plan no disponible.")
    n = SystemTable.objects.filter(system=system, is_deleted=False).count()
    if n >= plan.max_tables_per_system:
        raise ValueError(
            f"Límite de {plan.max_tables_per_system} tablas por sistema alcanzado (plan {plan.name})."
        )


def user_has_ai(user: User) -> bool:
    return True

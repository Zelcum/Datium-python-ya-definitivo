from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Tuple

from api.models import System, SystemCollaborator, User
from api.plans import user_has_ai


@dataclass(frozen=True)
class PermissionResult:
    allowed: bool
    reason: Optional[str] = None


def get_current_user(request) -> Optional[User]:
    uid = None
    try:
        uid = request.session.get("user_id")
    except Exception:
        try:
            uid = request._request.session.get("user_id")
        except Exception:
            uid = None

    if not uid:
        return None
    try:
        return User.objects.get(id=uid)
    except User.DoesNotExist:
        return None


def ensure_authenticated(request) -> Tuple[Optional[User], PermissionResult]:
    user = get_current_user(request)
    if not user:
        return None, PermissionResult(False, "No autenticado")
    return user, PermissionResult(True)


def ensure_system_access(user: User, system_id: Optional[int]) -> PermissionResult:
    if system_id is None:
        return PermissionResult(True)
    exists = System.objects.filter(id=system_id, owner=user).exists()
    if exists or getattr(user, 'role', 'user') == 'admin':
        return PermissionResult(True)
    collab = SystemCollaborator.objects.filter(system_id=system_id, user=user, can_read=True).exists()
    if not collab:
        return PermissionResult(False, "No tienes permiso para acceder a este sistema.")
    return PermissionResult(True)


def ensure_ai_plan_access(user: User) -> PermissionResult:
    if user_has_ai(user):
        return PermissionResult(True)
    return PermissionResult(False, "IA no disponible.")

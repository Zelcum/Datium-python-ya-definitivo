from __future__ import annotations

from typing import Optional

MAX_INT32 = 2147483647


def get_active_system_id_from_request(request) -> Optional[int]:
    sys_id = None
    try:
        sys_id = request.data.get("system_id")
    except Exception:
        pass
    if sys_id is None:
        try:
            sys_id = request.POST.get("system_id")
        except Exception:
            sys_id = None

    if sys_id in (None, "", "null", "None"):
        return None
    try:
        value = int(sys_id)
        if value < 1 or value > MAX_INT32:
            return None
        return value
    except Exception:
        return None

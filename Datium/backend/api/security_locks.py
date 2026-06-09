from django.core.cache import cache

LOGIN_FAIL_WINDOW = 900
LOGIN_LOCK_SECONDS = 600
PWD_VERIFY_WINDOW = 900
PWD_LOCK_SECONDS = 600
MAX_ATTEMPTS = 5


def _key(prefix, identifier):
    return f"datium:{prefix}:{identifier}"


def is_login_locked(identifier: str) -> bool:
    return bool(cache.get(_key("login_lock", identifier.lower())))


def record_login_failure(identifier: str):
    k = _key("login_fail", identifier.lower())
    n = int(cache.get(k) or 0) + 1
    cache.set(k, n, timeout=LOGIN_FAIL_WINDOW)
    if n >= MAX_ATTEMPTS:
        cache.set(_key("login_lock", identifier.lower()), 1, timeout=LOGIN_LOCK_SECONDS)
        cache.delete(k)


def clear_login_failures(identifier: str):
    cache.delete(_key("login_fail", identifier.lower()))
    cache.delete(_key("login_lock", identifier.lower()))


def is_password_verify_locked(user_id: int) -> bool:
    return bool(cache.get(_key("pwd_lock", str(user_id))))


def record_password_verify_failure(user_id: int) -> int:
    k = _key("pwd_fail", str(user_id))
    n = int(cache.get(k) or 0) + 1
    cache.set(k, n, timeout=PWD_VERIFY_WINDOW)
    if n >= MAX_ATTEMPTS:
        cache.set(_key("pwd_lock", str(user_id)), 1, timeout=PWD_LOCK_SECONDS)
        cache.delete(k)
    return n


def clear_password_verify_failures(user_id: int):
    cache.delete(_key("pwd_fail", str(user_id)))
    cache.delete(_key("pwd_lock", str(user_id)))

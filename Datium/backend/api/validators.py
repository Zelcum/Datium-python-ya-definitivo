import re

PROFILE_NAME_RE = re.compile(r"^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:[ '-][A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$")
SYSTEM_NAME_RE = re.compile(
    r"^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ](?:[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ _-]{3,98}[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ])$"
)
SYSTEM_PASSWORD_RE = re.compile(r"^[A-Za-z0-9]+$")
PHONE_DIGITS_RE = re.compile(r"^\+?[0-9]{10,15}$")
EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
TABLE_NAME_RE = re.compile(r"^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ _-]{2,100}$")
ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'}


def validate_email(email: str):
    if not email or not str(email).strip():
        return "El email es obligatorio."
    if not EMAIL_RE.match(str(email).strip()):
        return "El formato de email no es válido."
    return None


def validate_profile_name(name: str):
    if not name or not str(name).strip():
        return "El nombre es obligatorio."
    name = str(name).strip()
    if len(name) < 3 or len(name) > 50:
        return "El nombre debe tener entre 3 y 50 caracteres."
    if not PROFILE_NAME_RE.match(name):
        return "El nombre solo puede contener letras, espacios, apóstrofes o guiones."
    return None


def validate_profile_phone(phone: str):
    if phone is None or str(phone).strip() == "":
        return None
    raw = str(phone).strip().replace(" ", "")
    if not PHONE_DIGITS_RE.match(raw):
        return "Teléfono inválido. Usa solo dígitos, opcional + al inicio (10 dígitos mínimo)."
    digits = re.sub(r"\D", "", raw)
    if len(digits) < 10:
        return "El teléfono debe tener al menos 10 dígitos."
    return None


def validate_new_password(pw: str):
    if not pw or len(pw) < 8:
        return "La contraseña nueva debe tener al menos 8 caracteres."
    strength = 0
    if len(pw) >= 8:
        strength += 1
    if len(pw) >= 10:
        strength += 1
    if re.search(r"[A-Z]", pw):
        strength += 1
    if re.search(r"[0-9]", pw):
        strength += 1
    if re.search(r"[^A-Za-z0-9]", pw):
        strength += 1
    if strength < 3:
        return "La contraseña es muy débil. Combina mayúsculas, números y símbolos."
    return None


def validate_system_name(name: str):
    if not name or not str(name).strip():
        return "El nombre del sistema es obligatorio."
    name = str(name).strip()
    if len(name) < 5 or len(name) > 100:
        return "El nombre del sistema debe tener entre 5 y 100 caracteres."
    if not SYSTEM_NAME_RE.match(name):
        return "El nombre solo puede usar letras, números y espacios (sin símbolos especiales)."
    return None


def validate_system_general_password(pw: str):
    if not pw:
        return "La contraseña de acceso es obligatoria en modo privado."
    if len(pw) < 8 or len(pw) > 128:
        return "La contraseña del sistema debe tener entre 8 y 128 caracteres."
    if not SYSTEM_PASSWORD_RE.match(pw):
        return "La contraseña del sistema debe ser alfanumérica."
    return None


def validate_table_name(name: str):
    if not name or not str(name).strip():
        return "El nombre de la tabla es obligatorio."
    name = str(name).strip()
    if len(name) < 2 or len(name) > 100:
        return "El nombre de la tabla debe tener entre 2 y 100 caracteres."
    if not TABLE_NAME_RE.match(name):
        return "El nombre de la tabla solo puede usar letras, números, espacios y guiones."
    return None


def validate_image_extension(filename: str):
    if not filename:
        return "Nombre de archivo requerido."
    import os
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        return f"Tipo de archivo no permitido. Usa: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}"
    return None


def validate_report_fields(title: str, summary: str):
    if not title or not str(title).strip():
        return "El título del reporte es obligatorio."
    if len(str(title).strip()) < 3:
        return "El título debe tener al menos 3 caracteres."
    if not summary or not str(summary).strip():
        return "La descripción del reporte es obligatoria."
    if len(str(summary).strip()) < 10:
        return "La descripción debe tener al menos 10 caracteres."
    return None

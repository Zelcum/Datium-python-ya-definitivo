from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import requests
from api.models import System, SystemField, SystemRecord, SystemRecordValue, SystemTable, User


DATIUM_OLLAMA_URL = os.getenv("DATIUM_OLLAMA_URL", os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")).rstrip("/")
DATIUM_PRIMARY_MODEL = os.getenv("DATIUM_AI_MODEL", "qwen3.5:cloud")
DATIUM_FALLBACK_MODEL = os.getenv("DATIUM_AI_FALLBACK", "qwen3.5:cloud")


@dataclass(frozen=True)
class AiConfig:
    model: str = "qwen3.5:cloud"
    fallback_model: str = "qwen3.5:cloud"
    enabled: bool = True
    chatbot_id: str = "datium-default"


def build_schema_context(user: User, system_id: Optional[int]) -> str:
    systems = System.objects.filter(owner=user)
    if system_id:
        systems = systems.filter(id=system_id)

    if not systems.exists():
        return "El usuario no tiene sistemas registrados en este contexto."

    tables = SystemTable.objects.filter(system__in=systems).select_related("system").order_by("system__name", "name")
    fields = SystemField.objects.filter(table__in=tables).order_by("table_id", "order_index")
    fields_by_table: Dict[int, List] = {}
    for f in fields:
        fields_by_table.setdefault(f.table_id, []).append(f)

    out = ["ESTRUCTURA COMPLETA DE DATOS (CRUD HABILITADO):"]
    current_sys = None
    for t in tables:
        if t.system_id != current_sys:
            current_sys = t.system_id
            out.append(f"[SISTEMA: {t.system.name} (ID:{t.system_id})]")
        tf = fields_by_table.get(t.id, [])
        f_list = ", ".join([f"{f.name}:{f.id}({f.type})" for f in tf])
        out.append(f" - {t.name} (ID:{t.id}): {f_list}")
    return "\n".join(out)


def _resolve_relation_value(field: SystemField, value: Any) -> Any:
    if not value or field.type != "relation" or not field.related_table_id:
        return value
    try:
        rel_rec_id = int(str(value).strip())
        related_record = SystemRecord.objects.get(id=rel_rec_id)
        display_field = field.related_display_field
        if display_field:
            val_obj = SystemRecordValue.objects.filter(record=related_record, field=display_field).first()
            if val_obj:
                return val_obj.value
        first_val = SystemRecordValue.objects.filter(record=related_record).first()
        return first_val.value if first_val else f"Ref:{value}"
    except Exception:
        return value


def build_real_data_context(user: User, message: str, system_id: Optional[int]) -> str:
    systems = System.objects.filter(owner=user)
    if system_id:
        systems = systems.filter(id=system_id)

    all_tables = SystemTable.objects.filter(system__in=systems)
    message_lower = (message or "").lower()

    mentioned = []
    if system_id and all_tables.exists():
        mentioned = list(all_tables)
    else:
        for t in all_tables:
            if t.name.lower() in message_lower or any(len(w) > 3 and w.lower() in message_lower for w in t.name.split()):
                mentioned.append(t)

    if not mentioned:
        return ""

    table_ids = [t.id for t in mentioned]
    all_fields = list(SystemField.objects.filter(table_id__in=table_ids).order_by("table_id", "order_index"))
    fields_by_table: Dict[int, List] = {}
    for f in all_fields:
        fields_by_table.setdefault(f.table_id, []).append(f)

    all_records = list(SystemRecord.objects.filter(table_id__in=table_ids).order_by("-id"))
    records_by_table: Dict[int, List] = {}
    for r in all_records:
        bucket = records_by_table.setdefault(r.table_id, [])
        if len(bucket) < 10:
            bucket.append(r)

    record_ids = [r.id for recs in records_by_table.values() for r in recs]
    all_values = list(SystemRecordValue.objects.filter(record_id__in=record_ids).select_related("field")) if record_ids else []
    values_by_record: Dict[int, List] = {}
    for v in all_values:
        values_by_record.setdefault(v.record_id, []).append(v)

    parts = ["DATOS REALES ENCONTRADOS (USA ESTOS DATOS LITERALES, NO INVENTES):"]
    for t in mentioned:
        fields = fields_by_table.get(t.id, [])
        f_header = " | ".join([f.name for f in fields])
        records = records_by_table.get(t.id, [])

        rows = []
        for rec in records:
            vals = values_by_record.get(rec.id, [])
            row_dict = {v.field.name: _resolve_relation_value(v.field, v.value) for v in vals}
            row_str = " | ".join([str(row_dict.get(f.name, "")) for f in fields])
            rows.append(f"| {row_str} |")

        if not rows:
            parts.append(f"\n[TABLA: {t.name}]\nCOLUMNAS: {f_header}\n(La tabla esta vacia.)")
        else:
            parts.append(f"\n[TABLA: {t.name}]\nCOLUMNAS: {f_header}\n" + "\n".join(rows))

    return "\n".join(parts)


def build_system_prompt(*, user: User, system_id: Optional[int], user_message: str, file_context: str = "") -> str:
    schema = build_schema_context(user, system_id)
    real_data = build_real_data_context(user, user_message, system_id)
    user_name = (user.name or user.email or "Usuario").strip()
    user_email = user.email
    user_role = user.role
    user_phone = user.phone or "No registrado"
    user_expertise = user.expertise_level
    user_plan = user.plan.name if user.plan else "Sin plan"

    focus_rule = ""
    if system_id:
        focus_rule = "- ESTRICTAMENTE PROHIBIDO usar 'create_system' o 'delete_system'. Como ya hay un sistema seleccionado (FOCO_SISTEMA_ID), todas las tablas que pida el usuario DEBES obligatoriamente crearlas dentro de este sistema usando 'create_table', NUNCA crees sistemas nuevos."

    return (
        "Eres la IA administrativa integrada de Datium.\n"
        "Hablas natural, ejecutiva, formal, clara y precisa. Jamas suenas robotica ni repites plantillas.\n"
        "REGLA CRITICA DE FORMATO: AHORA SOPORTAS MARKDOWN OFICIAL Y NATIVO. Puedes y debes usar negritas (**texto**), listas enumeradas y crear tablas (usando |) para estructurar datos visualmente para el usuario.\n"
        "Tienes el mismo contexto operativo del usuario logueado dentro del sistema.\n"
        "\n"
        "INFORMACION DEL USUARIO LOGUEADO:\n"
        f"- Nombre: {user_name}\n"
        f"- Email: {user_email}\n"
        f"- Rol: {user_role}\n"
        f"- Telefono: {user_phone}\n"
        f"- Nivel de Experiencia: {user_expertise}\n"
        f"- Plan Actual: {user_plan}\n"
        "\n"
        "REGLAS:\n"
        "- Responde como una persona formal, y cuando toque operar el sistema se altamente precisa y ejecutiva.\n"
        "- Usa parrafos breves y directos. Evita listas decorativas innecesarias.\n"
        "- No inventes datos. Si no hay filas, responde literalmente: \"La tabla esta vacia.\".\n"
        "- Siempre respeta el FOCO (sistema activo). Si existe un sistema enfocado, toda consulta o accion debe resolverse ahi.\n"
        f"{focus_rule}\n"
        "- Nunca reutilices plantillas fijas antiguas como asistencia escolar, CRM u otras, a menos que se pida explicitamente.\n"
        "- Si el usuario quiere crear una estructura, disena exactamente lo que pidio con los campos minimos necesarios.\n"
        "- Si propones crear, editar, mover o eliminar elementos, incluye ademas un bloque JSON al final para confirmacion.\n"
        "- Si la accion elimina algo, advierte de forma breve que pedira contrasena antes de ejecutar.\n"
        "- Si la accion es sensible, menciona que quedara registrada en auditoria.\n"
        "- El texto visible para el usuario debe poder leerse por si solo, sin mencionar reglas internas.\n"
        "- Nunca mezcles caracteres raros, simbolos corruptos o texto con encoding roto. Solo espanol formal.\n"
        f"- Trataras al usuario cordialmente como: {user_name}, y tendras en cuenta su nivel ({user_expertise}) y rol ({user_role}).\n"
        "\n"
        "CUANDO PROPONGAS CAMBIOS:\n"
        "- Explica breve que vas a crear o modificar devolviendo siempre el contexto JSON.\n"
        "- Muestra la estructura propuesta en lenguaje humano.\n"
        "- Luego incluye un bloque JSON válido con este formato EXACTO:\n"
        "```json\n"
        "{\"confirmation_required\": true, \"summary\": \"...\", \"actions\": [{\"action\":\"...\",\"payload\":{...}}]}\n"
        "```\n"
        "- MANTEN TU RESPUESTA DE TEXTO FUERA DEL BLOQUE JSON. El bloque JSON debe ir obligatoriamente al final de tu mensaje.\n"
        "- NUNCA incluyas texto normal ni saludos dentro del JSON. El JSON debe ser estrictamente válido.\n"
        "- Acciones validas: create_system, update_system, delete_system, list_tables, create_table, update_table, delete_table, list_records, create_record, update_record, delete_record.\n"
        "- Estructura correcta create_system: {action:'create_system', payload:{name, description, imageUrl?, securityMode?, tables:[{name, description?, fields:[...]}]}}.\n"
        "- Tipos validos campo: text, number, date, boolean, select, relation.\n"
        "\n"
        f"FOCO_SISTEMA_ID: {system_id if system_id else 'GLOBAL'}\n"
        f"\n{schema}\n"
        f"\n{real_data}\n"
        f"\nCONTEXTO_ARCHIVOS:\n{file_context.strip()}\n"
        f"\nMENSAJE_ACTUAL_DEL_USUARIO:\n{user_message.strip()}\n"
    ).strip()


def _clean_ai_text(text: str) -> str:
    if not text:
        return ""
    cleaned = text
    cleaned = cleaned.replace("```json", "").replace("```", "")
    return cleaned.strip()


def _chat_ollama(model: str, messages: List[Dict[str, str]], stream_callback=None) -> str:
    target_model = model.split(":", 1)[1] if ":" in model else model
    payload = {
        "model": target_model,
        "messages": messages,
        "stream": bool(stream_callback),
        "options": {"temperature": 0.35, "num_predict": 1024, "num_ctx": 4096},
    }
    response = requests.post(f"{DATIUM_OLLAMA_URL}/api/chat", json=payload, timeout=180, stream=bool(stream_callback))
    if response.status_code != 200:
        raise RuntimeError(f"Ollama error {response.status_code}: {response.text[:200]}")
    
    if stream_callback:
        full_text = []
        for line in response.iter_lines():
            if line:
                try:
                    data = json.loads(line)
                    content = (data.get("message") or {}).get("content", "")
                    if content:
                        stream_callback(content)
                        full_text.append(content)
                except Exception:
                    pass
        return "".join(full_text)
    else:
        data = response.json()
        return (data.get("message") or {}).get("content", "")



_model_cache: Dict[str, Any] = {"ts": 0.0, "models": []}


def _ollama_available_models() -> List[str]:
    import time
    now = time.time()
    if now - _model_cache["ts"] < 60 and _model_cache["models"]:
        return _model_cache["models"]
    try:
        r = requests.get(f"{DATIUM_OLLAMA_URL}/api/tags", timeout=6)
        if r.status_code != 200:
            return _model_cache["models"]
        payload = r.json()
        models = [str(m["name"]).strip() for m in payload.get("models", []) if isinstance(m, dict) and m.get("name")]
        _model_cache["ts"] = now
        _model_cache["models"] = models
        return models
    except Exception:
        return _model_cache["models"]


def ollama_chat(model: str, messages: List[Dict[str, str]], fallback_model: Optional[str] = None, stream_callback=None) -> str:
    requested = model.split(":", 1)[1] if ":" in model else model
    configured_fallback = fallback_model.split(":", 1)[1] if fallback_model and ":" in fallback_model else (fallback_model or "")

    candidates = [requested]
    if configured_fallback and configured_fallback != requested:
        candidates.append(configured_fallback)
    if DATIUM_PRIMARY_MODEL not in candidates:
        candidates.append(DATIUM_PRIMARY_MODEL)
    if DATIUM_FALLBACK_MODEL not in candidates:
        candidates.append(DATIUM_FALLBACK_MODEL)

    installed = _ollama_available_models()
    for m in installed:
        if m not in candidates:
            candidates.append(m)

    seen = set()
    deduped = []
    for c in candidates:
        name = str(c or "").strip()
        if name and name not in seen:
            seen.add(name)
            deduped.append(name)

    errors = []
    for m in deduped:
        try:
            return _chat_ollama(f"local:{m}", messages, stream_callback=stream_callback)
        except Exception as exc:
            errors.append(f"{m}: {exc}")

    raise RuntimeError("No hay modelo de Ollama disponible. " + " | ".join(errors[:4]))


def _normalize_actions(parsed: Dict[str, Any]) -> List[Dict[str, Any]]:
    actions = parsed.get("actions", [])
    if not isinstance(actions, list):
        return []

    normalized: List[Dict[str, Any]] = []
    shared_tables = parsed.get("tables") if isinstance(parsed.get("tables"), list) else None
    for action in actions:
        if not isinstance(action, dict):
            continue
        action_name = action.get("action") or action.get("type")
        payload = action.get("payload") if isinstance(action.get("payload"), dict) else {}

        if action_name == "create_system":
            if "tables" not in payload:
                if isinstance(action.get("tables"), list):
                    payload["tables"] = action.get("tables")
                elif shared_tables is not None:
                    payload["tables"] = shared_tables
            action["payload"] = payload

        normalized.append(action)
    return normalized


def parse_actions_from_ai_text(ai_text: str) -> Dict[str, Any]:
    result: Dict[str, Any] = {"confirmation_required": False, "summary": "", "actions": []}
    if not ai_text:
        return result

    json_part = ""
    if "```json" in ai_text:
        json_part = ai_text.split("```json", 1)[1].split("```", 1)[0].strip()
    else:
        match = re.search(r"\{[\s\S]*\}", ai_text)
        if match:
            json_part = match.group(0).strip()
    if not json_part:
        return result

    try:
        parsed = json.loads(json_part)
        if isinstance(parsed, dict):
            result["confirmation_required"] = bool(parsed.get("confirmation_required", False))
            result["summary"] = parsed.get("summary", "") or ""
            result["actions"] = _normalize_actions(parsed)
        return result
    except Exception:
        return result


def strip_json_block(ai_text: str) -> str:
    if not ai_text:
        return ""
    if "```json" in ai_text:
        parts = ai_text.split("```json", 1)
        text_content = parts[0]
        after_block = parts[1].split("```", 1)
        if len(after_block) > 1:
            text_content += "\n" + after_block[1]
        return _clean_ai_text(text_content.strip())
    
    match = re.search(r"\{[\s\S]*\}", ai_text)
    if match:
        json_str = match.group(0)
        if '"actions"' in json_str or "'actions'" in json_str or '"summary"' in json_str:
            text_content = ai_text.replace(json_str, "")
            return _clean_ai_text(text_content.strip())
            
    return _clean_ai_text(ai_text.strip())

from __future__ import annotations
from openai import OpenAI
import os

client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1"
)


import json
import os
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import requests
from api.models import System, SystemField, SystemRecord, SystemRecordValue, SystemTable, User


DATIUM_OLLAMA_URL = os.getenv("DATIUM_OLLAMA_URL", os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")).rstrip("/")
DATIUM_PRIMARY_MODEL = os.getenv("DATIUM_AI_MODEL", "llama3")
DATIUM_FALLBACK_MODEL = os.getenv("DATIUM_AI_FALLBACK", "llama3")


@dataclass(frozen=True)
class AiConfig:
    model: str = "llama3"
    fallback_model: str = "llama3"
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
    user_plan = user.plan.name if user.plan else "Sin plan"
    user_expertise = user.expertise_level
    user_role = user.role

    focus_rule = ""
    if system_id:
        focus_rule = f"El sistema activo es ID {system_id}. NUNCA uses create_system. Toda nueva tabla va dentro de este sistema con create_table."

    return (
        f"Eres la IA administrativa de Datium. Formal, precisa y directa.\n"
        f"Usuario: {user_name} | Rol: {user_role} | Plan: {user_plan} | Nivel: {user_expertise}\n"
        f"FOCO_SISTEMA: {system_id if system_id else 'GLOBAL'}\n"
        f"{focus_rule}\n"
        "\n"
        "REGLAS ESTRICTAS:\n"
        "- Responde en español formal y directo. Sin relleno.\n"
        "- Usa Markdown: negritas, listas, tablas cuando aplique.\n"
        "- NO inventes datos. Si una tabla está vacía, dilo explícitamente.\n"
        "- Si propones crear, editar o eliminar algo, incluye al final un bloque JSON válido:\n"
        "```json\n"
        "{\"confirmation_required\": true, \"summary\": \"...\", \"actions\": [{\"action\":\"...\",\"payload\":{...}}]}\n"
        "```\n"
        "- Acciones válidas: create_system, update_system, delete_system, list_tables, create_table, update_table, delete_table, list_records, create_record, update_record, delete_record.\n"
        "- Tipos de campo válidos: text, number, date, boolean, select, relation.\n"
        "- El JSON va AL FINAL, nunca en medio del texto.\n"
        "\n"
        f"{schema}\n"
        f"{real_data}\n"
        f"{'CONTEXTO_ARCHIVOS:\\n' + file_context.strip() if file_context.strip() else ''}\n"
        f"MENSAJE: {user_message.strip()}\n"
    ).strip()


def _clean_ai_text(text: str) -> str:
    if not text:
        return ""
    cleaned = text
    cleaned = cleaned.replace("```json", "").replace("```", "")
    return cleaned.strip()


def _chat_ollama(model: str, messages: List[Dict[str, str]], stream_callback=None) -> str:
    # Usar el nombre del modelo directo, sin prefijos
    target_model = model.split(":", 1)[1] if model.startswith("local:") else model
    payload = {
        "model": target_model,
        "messages": messages,
        "stream": True,  # Siempre streaming para tiempo real
        "options": {
            "temperature": 0.3,
            "num_predict": 1536,
            "num_ctx": 4096,
            "top_p": 0.9,
            "repeat_penalty": 1.1,
        },
    }
    # Headers necesarios para que ngrok/localtunnel no bloqueen la petición con 403
    headers = {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
        "bypass-tunnel-reminder": "true",
        "User-Agent": "DatiumAI/1.0",
    }
    response = requests.post(
        f"{DATIUM_OLLAMA_URL}/api/chat",
        json=payload,
        headers=headers,
        timeout=180,
        stream=True,
    )
    if response.status_code != 200:
        raise RuntimeError(f"Ollama error {response.status_code}: {response.text[:200]}")

    full_text = []
    for line in response.iter_lines():
        if line:
            try:
                data = json.loads(line)
                content = (data.get("message") or {}).get("content", "")
                if content:
                    if stream_callback:
                        stream_callback(content)
                    full_text.append(content)
            except Exception:
                pass
    return "".join(full_text)


def _chat_groq(model: str, messages, stream_callback=None) -> str:
    stream = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.3,
        max_tokens=1500,
        stream=True
    )

    full_text = []

    for chunk in stream:
        if not chunk.choices:
            continue

        delta = chunk.choices[0].delta.content

        if delta:
            full_text.append(delta)

            if stream_callback:
                stream_callback(delta)

    return "".join(full_text)


_model_cache: Dict[str, Any] = {"ts": 0.0, "models": []}


def _ollama_available_models() -> List[str]:
    import time
    now = time.time()
    if now - _model_cache["ts"] < 30 and _model_cache["models"]:
        return _model_cache["models"]
    try:
        headers = {
            "ngrok-skip-browser-warning": "true",
            "bypass-tunnel-reminder": "true",
            "User-Agent": "DatiumAI/1.0",
        }
        r = requests.get(f"{DATIUM_OLLAMA_URL}/api/tags", headers=headers, timeout=8)
        if r.status_code != 200:
            return _model_cache["models"]
        payload = r.json()
        models = [str(m["name"]).strip() for m in payload.get("models", []) if isinstance(m, dict) and m.get("name")]
        _model_cache["ts"] = now
        _model_cache["models"] = models
        return models
    except Exception:
        return _model_cache["models"]


def _resolve_model(preferred: str) -> str:
    """
    Dada una preferencia de modelo (ej: 'llama3'), busca el mejor
    nombre real instalado en Ollama. Evita llamadas fallidas con 404.
    Estrategia:
      1. Si preferred coincide exactamente con un modelo instalado -> usarlo.
      2. Si algún modelo instalado empieza con preferred -> usarlo.
      3. Si preferred contiene ':' y el modelo base coincide -> usarlo.
      4. Usar el primer modelo instalado disponible.
    """
    installed = _ollama_available_models()
    if not installed:
        # Sin lista disponible, intentar con el nombre tal cual
        return preferred or DATIUM_PRIMARY_MODEL

    pref_lower = (preferred or "").lower().strip()

    # 1. Coincidencia exacta
    for m in installed:
        if m.lower() == pref_lower:
            return m

    # 2. El modelo instalado empieza con el nombre preferido (ej: "llama3" -> "llama3:latest")
    for m in installed:
        base = m.split(":")[0].lower()
        if base == pref_lower or m.lower().startswith(pref_lower):
            return m

    # 3. Si preferred tiene tag, comparar solo la base
    pref_base = pref_lower.split(":")[0]
    for m in installed:
        if m.lower().startswith(pref_base):
            return m

    # 4. Fallback: primer modelo disponible
    return installed[0]


def ollama_chat(
    model: str,
    messages: List[Dict[str, str]],
    fallback_model: Optional[str] = None,
    stream_callback=None
) -> str:

    model_name = model or os.getenv(
        "DATIUM_AI_MODEL",
        "llama-3.3-70b-versatile"
    )

    return _chat_groq(
        model_name,
        messages,
        stream_callback=stream_callback
    )

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

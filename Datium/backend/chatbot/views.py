import json
import os

from django.http import JsonResponse
from django.db import connection
from rest_framework.decorators import api_view

from .ai_engine import (
    build_system_prompt,
    ollama_chat,
    parse_actions_from_ai_text,
    strip_json_block,
)
from .file_handler import extract_text_from_file
from .permissions import ensure_ai_plan_access, ensure_authenticated, ensure_system_access
from .settings_panel import get_ai_config, get_available_chatbots
from .settings_panel import ai_settings_view
from .system_context import get_active_system_id_from_request
from .action_router import route_action
from .models import ChatConversation, ChatMessage
from api.models import AuditLog, SecurityAudit, System, SystemCollaborator, SystemField, SystemFieldOption, SystemRecord, SystemRecordValue, SystemTable, User


def ensure_chatbot_tables_ready():
    existing = set(connection.introspection.table_names())
    with connection.schema_editor() as schema_editor:
        if ChatConversation._meta.db_table not in existing:
            schema_editor.create_model(ChatConversation)
            existing.add(ChatConversation._meta.db_table)
        if ChatMessage._meta.db_table not in existing:
            schema_editor.create_model(ChatMessage)
            existing.add(ChatMessage._meta.db_table)


def _serialize_fields_for_restore(table_id: int) -> list[dict]:
    fields = SystemField.objects.filter(table_id=table_id).order_by("order_index")
    result = []
    for f in fields:
        item = {
            "name": f.name,
            "type": f.type,
            "required": f.required,
        }
        if f.type == "select":
            item["options"] = list(SystemFieldOption.objects.filter(field=f).values_list("value", flat=True))
        if f.type == "relation":
            item["relatedTableId"] = f.related_table_id
            item["relatedDisplayFieldId"] = f.related_display_field_id
            item["relatedTableName"] = f.related_table.name if f.related_table_id else None
        result.append(item)
    return result


def _serialize_record_values_for_restore(record_id: int) -> dict:
    values = {}
    for rv in SystemRecordValue.objects.filter(record_id=record_id).select_related("field"):
        values[str(rv.field_id)] = rv.value or ""
    return values


def _snapshot_undo_action(action_name: str, payload: dict) -> dict | None:
    if action_name == "update_system":
        sid = payload.get("systemId") or payload.get("id")
        prev = System.objects.filter(id=int(sid)).first() if sid else None
        if prev:
            return {
                "action": "update_system",
                "payload": {
                    "systemId": prev.id,
                    "name": prev.name,
                    "description": prev.description or "",
                    "imageUrl": prev.image_url or "",
                    "securityMode": prev.security_mode or "none",
                    "generalPassword": prev.general_password or "",
                },
            }

    if action_name == "update_table":
        table_id = payload.get("tableId")
        prev = SystemTable.objects.filter(id=int(table_id)).first() if table_id else None
        if prev:
            return {
                "action": "update_table",
                "payload": {
                    "systemId": prev.system_id,
                    "tableId": prev.id,
                    "name": prev.name,
                    "description": prev.description or "",
                    "fields": _serialize_fields_for_restore(prev.id),
                },
            }

    if action_name == "delete_table":
        table_id = payload.get("tableId")
        prev = SystemTable.objects.filter(id=int(table_id)).first() if table_id else None
        if prev:
            return {
                "action": "create_table",
                "payload": {
                    "systemId": prev.system_id,
                    "name": prev.name,
                    "description": prev.description or "",
                    "fields": _serialize_fields_for_restore(prev.id),
                },
            }

    if action_name == "update_record":
        record_id = payload.get("recordId")
        table_id = payload.get("tableId")
        prev = SystemRecord.objects.filter(id=int(record_id), table_id=int(table_id)).first() if record_id and table_id else None
        if prev:
            return {
                "action": "update_record",
                "payload": {
                    "tableId": prev.table_id,
                    "recordId": prev.id,
                    "values": _serialize_record_values_for_restore(prev.id),
                },
            }

    if action_name == "delete_record":
        record_id = payload.get("recordId")
        table_id = payload.get("tableId")
        prev = SystemRecord.objects.filter(id=int(record_id), table_id=int(table_id)).first() if record_id and table_id else None
        if prev:
            return {
                "action": "create_record",
                "payload": {
                    "tableId": prev.table_id,
                    "values": _serialize_record_values_for_restore(prev.id),
                },
            }

    return None


def _post_undo_action(action_name: str, payload: dict, result_data) -> dict | None:
    data = result_data if isinstance(result_data, dict) else {}
    if action_name == "create_system" and data.get("id"):
        return {"action": "delete_system", "payload": {"systemId": data["id"]}}
    if action_name == "create_table" and data.get("id"):
        return {"action": "delete_table", "payload": {"systemId": data.get("systemId") or payload.get("systemId"), "tableId": data["id"]}}
    if action_name == "create_record" and data.get("id"):
        return {"action": "delete_record", "payload": {"tableId": payload.get("tableId"), "recordId": data["id"]}}
    return None


def _get_conversation_id_from_request(request):
    try:
        cid = request.data.get("conversation_id")
    except Exception:
        cid = request.POST.get("conversation_id")
    if cid in (None, "", "null", "None"):
        return None
    try:
        return int(cid)
    except Exception:
        return None


def _get_or_create_conversation(user, system_id, conversation_id=None):
    try:
        conv = ChatConversation.objects.filter(user=user, system_id=system_id).order_by("id").first()
        if not conv:
            title = "Chat AI"
            if system_id:
                sys = System.objects.filter(id=system_id).first()
                if sys and sys.name:
                    title = f"Chat: {sys.name}"
            conv = ChatConversation.objects.create(user=user, system_id=system_id, title=title)

        ChatConversation.objects.filter(user=user, system_id=system_id).exclude(id=conv.id).delete()
        return conv
    except Exception:
        title = "Chat AI"
        return ChatConversation.objects.create(user=user, system_id=system_id, title=title)


@api_view(["GET", "POST"])
def conversations_view(request):
    try:
        ensure_chatbot_tables_ready()
        user, perm = ensure_authenticated(request)
        if not perm.allowed:
            return JsonResponse({"error": perm.reason}, status=401)

        system_id = get_active_system_id_from_request(request)
        conv = _get_or_create_conversation(user, system_id)

        if request.method == "GET":
            return JsonResponse(
                {
                    "status": "success",
                    "conversations": [
                        {"id": conv.id, "title": conv.title, "system_id": conv.system_id, "updated_at": conv.updated_at.isoformat()}
                    ],
                }
            )

        ChatMessage.objects.filter(user=user, conversation=conv).delete()
        return JsonResponse({"status": "success", "conversation": {"id": conv.id, "title": conv.title}}, status=201)
    except Exception as e:
        return JsonResponse({"error": f"Error en conversaciones: {str(e)}", "conversations": []}, status=500)


@api_view(["GET", "DELETE"])
def conversation_history_view(request, conversation_id: int):
    try:
        user, perm = ensure_authenticated(request)
        if not perm.allowed:
            return JsonResponse({"error": perm.reason}, status=401)

        conv = ChatConversation.objects.filter(id=conversation_id, user=user).first()
        if not conv:
            return JsonResponse({"error": "Conversacion no encontrada"}, status=404)

        if request.method == "DELETE":
            ChatMessage.objects.filter(user=user, conversation=conv).delete()
            ChatConversation.objects.filter(id=conv.id).update(title=conv.title)
            return JsonResponse({"status": "success", "message": "Memoria del chat borrada"})

        history = ChatMessage.objects.filter(user=user, conversation=conv).order_by("timestamp")
        return JsonResponse({"status": "success", "history": [{"role": m.role, "content": m.content} for m in history]})
    except Exception as e:
        return JsonResponse({"error": f"Error cargando conversacion: {str(e)}", "history": []}, status=500)


@api_view(['GET', 'POST', 'DELETE'])
def chat_view(request, system_id=None):
    try:
        user, perm = ensure_authenticated(request)
        if not perm.allowed:
            return JsonResponse({'error': perm.reason}, status=401)

        if request.method == 'GET':
            try:
                cid = request.GET.get("conversation_id")
                conv = _get_or_create_conversation(user, system_id, int(cid) if cid else None)
                history = ChatMessage.objects.filter(user=user, conversation=conv).order_by("timestamp")
                return JsonResponse(
                    {
                        "status": "success",
                        "conversation": {"id": conv.id, "title": conv.title},
                        "history": [{"role": m.role, "content": m.content} for m in history],
                    }
                )
            except Exception as e:
                return JsonResponse({'error': f'Error cargando chat: {str(e)}', 'history': []}, status=500)

        elif request.method == 'DELETE':
            try:
                cid = request.GET.get("conversation_id")
                conv = _get_or_create_conversation(user, system_id, int(cid) if cid else None)
                ChatMessage.objects.filter(user=user, conversation=conv).delete()
                return JsonResponse({"status": "success", "message": "Memoria del chat borrada"})
            except Exception as e:
                return JsonResponse({'error': f'Error limpiando chat: {str(e)}'}, status=500)

        elif request.method == 'POST':
            plan_perm = ensure_ai_plan_access(user)
            if not plan_perm.allowed:
                return JsonResponse(
                    {
                        "error": plan_perm.reason,
                        "plans": [
                            {"id": 1, "name": "Basico", "ai": False},
                            {"id": 2, "name": "Pro", "ai": True},
                            {"id": 3, "name": "Empresarial", "ai": True},
                        ],
                        "upgradeUrl": "/profile.html",
                    },
                    status=402,
                )

            cfg = get_ai_config()
            if not cfg.enabled:
                return JsonResponse({'error': 'IA desactivada en configuracion.'}, status=503)

            selected_chatbot_id = ""
            try:
                selected_chatbot_id = (request.data.get("chatbot_id") or "").strip()
            except Exception:
                selected_chatbot_id = (request.POST.get("chatbot_id") or "").strip()

            user_message_content = ""
            try:
                user_message_content = request.data.get("message", "") or ""
            except Exception:
                user_message_content = request.POST.get("message", "") or ""

            file_context = ""
            if getattr(request, "FILES", None):
                for file_obj in request.FILES.values():
                    label, text = extract_text_from_file(file_obj)
                    if text:
                        file_context += f"\n{label}\n{text}\n"
                    else:
                        file_context += f"\n{label}\n(Sin texto extraible)\n"

            if not user_message_content and not file_context:
                return JsonResponse({'error': 'Mensaje vacio'}, status=400)

            selected_system_id = system_id or get_active_system_id_from_request(request)
            perm2 = ensure_system_access(user, selected_system_id)
            if not perm2.allowed:
                return JsonResponse({'error': perm2.reason}, status=403)

            conv_id = _get_conversation_id_from_request(request)
            conv = _get_or_create_conversation(user, selected_system_id, conv_id)

            ChatMessage.objects.create(
                user=user,
                conversation=conv,
                system_id=selected_system_id,
                role='user',
                content=(user_message_content + ("\n" + file_context if file_context else "")).strip(),
            )

            import threading
            import queue
            
            def background_ai_task(user, conv, selected_system_id, messages_llm, target_model, cfg, q):
                try:
                    def stream_callback(token):
                        q.put(token)

                    ai_text = ollama_chat(target_model, messages_llm, cfg.fallback_model, stream_callback=stream_callback)
                    q.put(None)
                    
                    parsed = parse_actions_from_ai_text(ai_text)
                    content = strip_json_block(ai_text)
            
                    actions = parsed.get("actions", []) if isinstance(parsed, dict) else []
                    if not isinstance(actions, list):
                        actions = []
            
                    if selected_system_id:
                        for a in actions:
                            if not isinstance(a, dict):
                                continue
                            payload = a.get("payload")
                            if isinstance(payload, dict) and "systemId" not in payload:
                                if a.get("action") in ("create_table", "update_table", "delete_table", "list_tables"):
                                    payload["systemId"] = selected_system_id
            
                    if not content:
                        content = parsed.get("summary", "")
                    
                    if not content and not actions:
                        content = "No se obtuvo una respuesta valida del modelo."
                    elif not content and actions:
                        content = "Se propone ejecutar cambios en el sistema."
                    
                    content_to_save = content
                    if actions:
                        content_to_save += f"\n\n```json\n{json.dumps({'actions': actions})}\n```"
                        
                    ChatMessage.objects.create(user=user, conversation=conv, system_id=selected_system_id, role='assistant', content=content_to_save)
                except Exception as e:
                    q.put(None)
                    ChatMessage.objects.create(user=user, conversation=conv, system_id=selected_system_id, role='assistant', content=f"Error inesperado del modelo local: {str(e)}")

            system_prompt = build_system_prompt(
                user=user,
                system_id=selected_system_id,
                user_message=user_message_content,
                file_context=file_context,
            )

            history = ChatMessage.objects.filter(user=user, conversation=conv).order_by("timestamp")
            messages_llm = [{'role': 'system', 'content': system_prompt}]
            for msg in list(history)[-8:]:
                role = msg.role if msg.role in ('user', 'assistant', 'system') else 'user'
                messages_llm.append({'role': role, 'content': msg.content})

            try:
                available = get_available_chatbots()
                bot = next((b for b in available if b.get("id") == selected_chatbot_id), None) if selected_chatbot_id else None
                target_model = (bot or {}).get("model") or cfg.model
                
                # Start Thread with Queue
                q = queue.Queue()
                # Bot argument in original code is passed, but background_ai_task now expects q. We pass q at the end.
                t = threading.Thread(target=background_ai_task, args=(user, conv, selected_system_id, messages_llm, target_model, cfg, q))
                t.start()
                
                def stream_generator():
                    yield json.dumps({"_meta": {"conversation": {"id": conv.id, "title": conv.title}, "status": "streaming"}}) + "\n"
                    while True:
                        try:
                            chunk = q.get(timeout=120)
                            if chunk is None:
                                break
                            yield json.dumps({"text": chunk}) + "\n"
                        except queue.Empty:
                            break
                        except Exception:
                            break
                            
                from django.http import StreamingHttpResponse
                return StreamingHttpResponse(stream_generator(), content_type="application/x-ndjson")
            except Exception as e:
                return JsonResponse({'error': str(e)}, status=503)
    except Exception as e:
        return JsonResponse({'error': f'Error general del chat: {str(e)}'}, status=500)


@api_view(['POST'])
def execute_action_view(request):
    user, perm = ensure_authenticated(request)
    if not perm.allowed:
        return JsonResponse({'error': perm.reason}, status=401)

    plan_perm = ensure_ai_plan_access(user)
    if not plan_perm.allowed:
        return JsonResponse({'error': plan_perm.reason}, status=402)

    actions = []
    try:
        actions = request.data.get('actions', []) or []
    except Exception:
        actions = []

    ip = request.META.get("REMOTE_ADDR", "") or ""
    undo_actions = []
    password = ""
    try:
        password = (request.data.get("password") or "").strip()
    except Exception:
        password = ""

    results = []
    for a in actions:
        if not isinstance(a, dict):
            results.append({'ok': False, 'error': 'Accion invalida'})
            continue

        action_name = a.get("action") or a.get("type")
        payload = a.get("payload") or a
        is_delete = str(action_name).startswith("delete_")

        try:
            system_id = payload.get("systemId")
            if not system_id:
                table_id = payload.get("tableId") or payload.get("table_id")
                if table_id:
                    system_id = SystemTable.objects.filter(id=int(table_id)).values_list("system_id", flat=True).first()
                else:
                    record_id = payload.get("recordId") or payload.get("record_id")
                    if record_id:
                        system_id = SystemRecord.objects.filter(id=int(record_id)).values_list("table__system_id", flat=True).first()
            system = System.objects.filter(id=int(system_id)).first() if system_id else None
        except Exception:
            system = None

        if is_delete:
            if system:
                SecurityAudit.objects.create(
                    user=user,
                    system=system,
                    severity="high",
                    event="IA_DELETE_EXECUTED",
                    details=json.dumps(payload, ensure_ascii=False)[:2000],
                )

        undo_candidate = _snapshot_undo_action(action_name, payload)

        try:
            if system:
                AuditLog.objects.create(
                    user=user,
                    system=system,
                    action=f"IA_{str(action_name).upper()}",
                    details=json.dumps(payload, ensure_ascii=False)[:2000],
                    ip=ip,
                )
        except Exception:
            pass

        r = route_action(request, action_name, payload)
        links = []
        try:
            if r.ok and isinstance(r.data, dict):
                if action_name in ("create_system", "update_system"):
                    sid = r.data.get("id")
                    name = r.data.get("name", "Sistema")
                    if sid:
                        links.append({"label": f"Abrir sistema {name}", "url": f"/system.html?id={sid}"})
                    for t in r.data.get("tables", []) or []:
                        if isinstance(t, dict) and t.get("id"):
                            links.append({"label": f"Abrir tabla {t.get('name', 'Tabla')}", "url": f"/table.html?id={t['id']}"})
                if action_name in ("create_table", "update_table"):
                    tid = r.data.get("id")
                    name = r.data.get("name", "Tabla")
                    if tid:
                        links.append({"label": f"Abrir tabla {name}", "url": f"/table.html?id={tid}"})
            if r.ok:
                undo_candidate = undo_candidate or _post_undo_action(action_name, payload, r.data)
                if undo_candidate:
                    undo_actions.append(undo_candidate)
        except Exception:
            links = []

        results.append({'ok': r.ok, 'status_code': r.status_code, 'data': r.data, 'error': r.error, 'links': links, 'undo_action': undo_candidate})

    return JsonResponse({'status': 'success', 'results': results, 'undo_actions': undo_actions})


@api_view(['GET'])
def model_status(request):
    cfg = get_ai_config()
    if not cfg.enabled:
        return JsonResponse({'status': 'OFFLINE', 'model': cfg.model, 'fallback_model': cfg.fallback_model, 'enabled': False})
    return JsonResponse({'status': 'ONLINE', 'model': cfg.model, 'fallback_model': cfg.fallback_model, 'enabled': True})


@api_view(['GET'])
def chatbots_view(request):
    user, perm = ensure_authenticated(request)
    if not perm.allowed:
        return JsonResponse({'error': perm.reason}, status=401)
    cfg = get_ai_config()
    bots = get_available_chatbots()
    return JsonResponse({"status": "success", "chatbots": bots, "selected": cfg.chatbot_id})


@api_view(['GET'])
def share_targets_view(request):
    user, perm = ensure_authenticated(request)
    if not perm.allowed:
        return JsonResponse({'error': perm.reason}, status=401)
    system_id = get_active_system_id_from_request(request)
    if system_id is None:
        raw = request.GET.get('system_id')
        try:
            system_id = int(raw) if raw else None
        except Exception:
            system_id = None
    targets = []
    if user.phone:
        targets.append({'id': f'user-{user.id}', 'name': f'{user.name or user.email} (Tu)', 'phone': user.phone, 'kind': 'self'})
    if system_id:
        collabs = SystemCollaborator.objects.filter(system_id=system_id).select_related('user')
        for c in collabs:
            if c.user and c.user.phone:
                targets.append({'id': f'user-{c.user.id}', 'name': c.user.name or c.user.email, 'phone': c.user.phone, 'kind': 'member'})
        owner = System.objects.filter(id=system_id).select_related('owner').first()
        if owner and owner.owner and owner.owner.phone and owner.owner_id != user.id:
            targets.insert(0, {'id': f'user-{owner.owner.id}', 'name': f'{owner.owner.name or owner.owner.email} (Owner)', 'phone': owner.owner.phone, 'kind': 'owner'})
    dedup = []
    seen = set()
    for t in targets:
        key = (t['phone'] or '').strip()
        if key and key not in seen:
            seen.add(key)
            dedup.append(t)
    return JsonResponse({'targets': dedup})


@api_view(["POST"])
def api_message_view(request):
    resp = chat_view(request)
    try:
        if resp.status_code >= 400:
            return resp
        payload = json.loads(resp.content.decode("utf-8"))
        return JsonResponse({"reply": payload.get("content", ""), "actions": payload.get("actions", [])})
    except Exception:
        return JsonResponse({"reply": "", "actions": []}, status=200)


@api_view(["POST"])
def openclaw_bridge_view(request):
    configured_secret = os.getenv("DATIUM_OPENCLAW_SECRET", "").strip()
    provided_secret = (
        request.headers.get("X-OpenClaw-Secret")
        or request.headers.get("X-Datium-Secret")
        or request.data.get("secret")
        or ""
    ).strip()

    raw_request = getattr(request, "_request", request)
    user = None

    try:
        session_uid = raw_request.session.get("user_id")
    except Exception:
        session_uid = None

    if session_uid:
        user = User.objects.filter(id=session_uid).first()
    else:
        if not configured_secret:
            return JsonResponse({"error": "Bridge no configurado. Define DATIUM_OPENCLAW_SECRET."}, status=503)
        if provided_secret != configured_secret:
            return JsonResponse({"error": "No autorizado"}, status=401)

        user_id = request.data.get("user_id")
        email = (request.data.get("email") or "").strip().lower()

        if user_id not in (None, "", "null", "None"):
            try:
                user = User.objects.filter(id=int(user_id)).first()
            except Exception:
                user = None
        if user is None and email:
            user = User.objects.filter(email__iexact=email).first()
        if user is None:
            return JsonResponse({"error": "Usuario no encontrado"}, status=404)

        raw_request.session["user_id"] = user.id
        try:
            raw_request.session.save()
        except Exception:
            pass

    system_id = request.data.get("system_id")
    if system_id not in (None, "", "null", "None"):
        try:
            system_id = int(system_id)
        except Exception:
            return JsonResponse({"error": "system_id invalido"}, status=400)
    else:
        system_id = None

    if system_id is not None and not System.objects.filter(id=system_id, owner=user).exists():
        return JsonResponse({"error": "El usuario no tiene acceso a ese sistema"}, status=403)

    response = chat_view(raw_request, system_id=system_id)
    try:
        payload = json.loads(response.content.decode("utf-8"))
    except Exception:
        payload = {}

    if response.status_code >= 400:
        return JsonResponse(payload or {"error": "Error del chatbot"}, status=response.status_code)

    return JsonResponse(
        {
            "ok": True,
            "reply": payload.get("content", ""),
            "actions": payload.get("actions", []),
            "conversation": payload.get("conversation", {}),
            "confirmation_required": bool(payload.get("confirmation_required", False)),
            "summary": payload.get("summary", ""),
            "user": {"id": user.id, "email": user.email, "name": user.name},
            "system_id": system_id,
        },
        status=response.status_code or 200,
    )

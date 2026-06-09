from __future__ import annotations

from dataclasses import asdict
import json
import os
from typing import Any, Dict

from django.http import JsonResponse
from rest_framework.decorators import api_view

from .ai_engine import AiConfig, DATIUM_PRIMARY_MODEL, DATIUM_FALLBACK_MODEL
from .permissions import ensure_authenticated


_CONFIG = AiConfig(
    model=DATIUM_PRIMARY_MODEL,
    fallback_model=DATIUM_FALLBACK_MODEL,
    enabled=True,
    chatbot_id="datium-default"
)


def get_available_chatbots() -> list[dict]:
    raw = (os.getenv("DATIUM_CHATBOTS", "") or "").strip()
    if not raw:
        return [
            {"id": "datium-default", "name": "Datium IA", "model": _CONFIG.model},
        ]
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            clean = []
            for item in parsed:
                if not isinstance(item, dict):
                    continue
                bot_id = str(item.get("id", "")).strip()
                if not bot_id:
                    continue
                clean.append(
                    {
                        "id": bot_id,
                        "name": str(item.get("name", bot_id)).strip(),
                        "model": str(item.get("model", _CONFIG.model)).strip(),
                    }
                )
            if clean:
                return clean
    except Exception:
        pass
    return [{"id": "datium-default", "name": "Datium IA", "model": _CONFIG.model}]


@api_view(["GET", "PUT"])
def ai_settings_view(request):
    user, perm = ensure_authenticated(request)
    if not perm.allowed:
        return JsonResponse({"error": perm.reason}, status=401)

    global _CONFIG
    if request.method == "GET":
        return JsonResponse({"ok": True, "config": asdict(_CONFIG)})

    data: Dict[str, Any] = {}
    try:
        data = request.data or {}
    except Exception:
        data = {}

    enabled = data.get("enabled", _CONFIG.enabled)
    model = data.get("model", _CONFIG.model)
    fallback_model = data.get("fallback_model", _CONFIG.fallback_model)
    _CONFIG = AiConfig(model=str(model), fallback_model=str(fallback_model), enabled=bool(enabled))
    return JsonResponse({"ok": True, "config": asdict(_CONFIG)})


def get_ai_config() -> AiConfig:
    return _CONFIG

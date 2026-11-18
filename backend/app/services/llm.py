"""
Cliente del modelo generativo usado para el pipeline RAG (Fase 3, parte 1).

Modelo: GPT-OSS 120B (OpenAI, open-weight) vía Together.ai (pago por uso).
Together ha ido reduciendo su catálogo "serverless" varias veces durante este
proyecto (primero quitó toda la familia Llama, el 2026-10-26; después, el
2026-11-18, también quitó MiniMax-M3, que era el modelo que usábamos hasta
ese momento) — es un cambio de la plataforma, no algo específico de esta
cuenta ni un problema de saldo/tarjeta. Se volvió a probar en vivo el
catálogo completo de modelos "serverless" disponibles para esta cuenta y,
de los pocos que seguían respondiendo, GPT-OSS 120B fue el único
razonablemente rápido y confiable: aunque SÍ es un modelo "de razonamiento"
(gasta parte del presupuesto de `max_tokens` en un campo separado
`reasoning_content` antes de dar la respuesta final), se probó en vivo con
el mismo tipo de prompt que usa este proyecto (JSON Mode y texto libre) y el
campo final `content` llegó completo y con JSON válido sin truncarse, incluso
con el único `max_tokens` más bajo (600, el del chat) — los demás candidatos
de razonamiento probados (MiniMax-M3.1-Flash, GLM-5.3-Flash, Qwen3.5-9B)
agotaban TODO el presupuesto en razonamiento y devolvían `content: null`.

Es INTENCIONALMENTE distinto al modelo que se afinará con QLoRA más adelante
(Llama 3.1 8B, descargado directo de Hugging Face en Colab) — el RAG no
necesita el modelo final, solo un modelo real y disponible para poder construir
y probar el pipeline. Si Together vuelve a cambiar su catálogo serverless,
revisar primero `together.ai/models` (filtro "Serverless") antes de asumir que
es un bug del código.
"""

from __future__ import annotations

import asyncio
import json
import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

TOGETHER_API_URL = "https://api.together.xyz/v1/chat/completions"
TOGETHER_MODEL = "openai/gpt-oss-120b"
REQUEST_TIMEOUT = 90.0
MAX_RETRIES = 2
# Together (como cualquier API compartida) a veces devuelve 503/429 por un
# bache momentáneo de carga, no porque algo esté mal de verdad — ya pasó en la
# práctica. Reintentar antes de reportar error evita que el usuario vea un
# fallo por algo que se resuelve solo en un par de segundos.
RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}


class LLMError(Exception):
    """Error al consultar el modelo generativo."""


async def _chat_completion(messages: list[dict], *, json_mode: bool, max_tokens: int) -> tuple[str, dict]:
    """Devuelve (contenido, usage). `usage` es el dict `{prompt_tokens,
    completion_tokens, total_tokens}` que regresa Together — se expone para
    poder medir gasto real al generar el dataset de fine-tuning (Actividad 2),
    donde sí importa cuidar el presupuesto prepagado."""
    settings = get_settings()
    if not settings.together_api_key:
        raise LLMError("TOGETHER_API_KEY no está configurada en el backend (.env).")

    payload = {
        "model": TOGETHER_MODEL,
        "messages": messages,
        "temperature": 0.4,
        "max_tokens": max_tokens,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    last_error: Exception | None = None
    for attempt in range(MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                resp = await client.post(
                    TOGETHER_API_URL,
                    headers={"Authorization": f"Bearer {settings.together_api_key}"},
                    json=payload,
                )
                if resp.status_code in RETRYABLE_STATUS_CODES and attempt < MAX_RETRIES:
                    wait = 2 ** attempt
                    logger.warning("Together respondió %s, reintentando en %ss", resp.status_code, wait)
                    await asyncio.sleep(wait)
                    continue
                if resp.status_code >= 400:
                    logger.error("TOGETHER DEBUG body: %s", resp.text[:1500])
                resp.raise_for_status()
                body = resp.json()
                content = body["choices"][0]["message"].get("content")
                if content is None:
                    # Modelo "de razonamiento" (gasta parte de max_tokens en el
                    # campo separado `reasoning_content`) que agotó todo el
                    # presupuesto razonando y no dejó nada para la respuesta
                    # final. Reintentar con más tokens antes de rendirse —
                    # igual que un 503, es una falla momentánea del modelo,
                    # no un error de nuestro código.
                    if attempt < MAX_RETRIES:
                        payload["max_tokens"] = min(payload["max_tokens"] * 2, 8000)
                        logger.warning(
                            "Together devolvió content vacío (razonamiento agotó el presupuesto), "
                            "reintentando con max_tokens=%s", payload["max_tokens"]
                        )
                        continue
                    raise LLMError(
                        "El modelo gastó todo su presupuesto de tokens razonando y no "
                        "alcanzó a dar una respuesta final. Intenta de nuevo."
                    )
                return content, body.get("usage", {})
        except httpx.HTTPError as exc:
            last_error = exc
            if attempt < MAX_RETRIES:
                await asyncio.sleep(2**attempt)
                continue
    raise LLMError(f"No se pudo consultar el modelo generativo: {last_error}")


async def generate_json(system_prompt: str, user_prompt: str, max_tokens: int = 5000) -> dict:
    """
    Llama al modelo en modo JSON (JSON Mode de Together/OpenAI-compatible) y
    devuelve el contenido ya parseado como dict. Usado para generar planes.

    El modelo actual (ver docstring del módulo) es "de razonamiento": gasta
    una cantidad variable de `max_tokens` pensando antes de escribir la
    respuesta final, así que a veces el JSON llega cortado a la mitad (ya
    pasó en producción: un plan completo con 3 comidas y explicaciones
    clínicas se truncó con max_tokens=3000). Si eso pasa, se reintenta una
    vez con el doble de presupuesto antes de rendirse — igual que el caso de
    `content` vacío en `_chat_completion`.
    """
    for attempt in range(2):
        content, _usage = await _chat_completion(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            json_mode=True,
            max_tokens=max_tokens,
        )
        try:
            return json.loads(content)
        except (json.JSONDecodeError, TypeError) as exc:
            if attempt == 0:
                max_tokens = min(max_tokens * 2, 10000)
                logger.warning(
                    "JSON truncado (%s), reintentando con max_tokens=%s", exc, max_tokens
                )
                continue
            raise LLMError(f"El modelo no devolvió un JSON válido: {exc}. Contenido: {content[:300]}") from exc


async def generate_json_with_usage(system_prompt: str, user_prompt: str, max_tokens: int = 5000) -> tuple[dict, dict]:
    """Igual que `generate_json`, pero también regresa el `usage` de tokens de
    la llamada — lo necesita `scripts/generate_finetune_dataset.py` para medir
    gasto real contra el presupuesto prepagado de Together.ai."""
    content, usage = await _chat_completion(
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        json_mode=True,
        max_tokens=max_tokens,
    )
    try:
        return json.loads(content), usage
    except (json.JSONDecodeError, TypeError) as exc:
        raise LLMError(f"El modelo no devolvió un JSON válido: {exc}. Contenido: {content[:300]}") from exc


async def generate_reply(system_prompt: str, conversation: list[dict]) -> str:
    """
    Llama al modelo en modo texto libre (sin JSON Mode) para una conversación
    multi-turno. `conversation` es la lista de mensajes previos
    (`[{"role": "user"|"assistant", "content": "..."}, ...]`), en orden.
    Usado para el chat del asistente.
    """
    messages = [{"role": "system", "content": system_prompt}, *conversation]
    content, _usage = await _chat_completion(messages, json_mode=False, max_tokens=1000)
    return content

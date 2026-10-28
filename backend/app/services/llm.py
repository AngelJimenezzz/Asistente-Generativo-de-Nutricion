"""
Cliente del modelo generativo usado para el pipeline RAG (Fase 3, parte 1).

Modelo: MiniMax-M3 vía Together.ai (pago por uso). Hasta el 2026-10-26 este
pipeline usaba Llama 3.3 70B Instruct Turbo, pero Together quitó TODOS los
modelos de la familia Llama de su catálogo "serverless" (se confirmó en vivo:
ningún modelo Llama, de ningún tamaño, está disponible en modo serverless para
esta cuenta — es un cambio de la plataforma, no algo específico de esta cuenta
ni un problema de saldo/tarjeta). Se probaron en vivo los modelos que sí siguen
en modo serverless (ver together.ai/models, filtro "Serverless") y MiniMax-M3
fue el que respondió de forma más limpia y consistente en modo JSON, sin gastar
el presupuesto de tokens en "razonamiento" interno antes de la respuesta final
(a diferencia de otros candidatos como DeepSeek V4.1 Flash o GLM 5.x, que son
modelos de razonamiento y arriesgan truncar el JSON de salida).

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
TOGETHER_MODEL = "MiniMaxAI/MiniMax-M3"
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
                return body["choices"][0]["message"]["content"], body.get("usage", {})
        except httpx.HTTPError as exc:
            last_error = exc
            if attempt < MAX_RETRIES:
                await asyncio.sleep(2**attempt)
                continue
    raise LLMError(f"No se pudo consultar el modelo generativo: {last_error}")


async def generate_json(system_prompt: str, user_prompt: str, max_tokens: int = 1500) -> dict:
    """
    Llama al modelo en modo JSON (JSON Mode de Together/OpenAI-compatible) y
    devuelve el contenido ya parseado como dict. Usado para generar planes.
    """
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
        raise LLMError(f"El modelo no devolvió un JSON válido: {exc}. Contenido: {content[:300]}") from exc


async def generate_json_with_usage(system_prompt: str, user_prompt: str, max_tokens: int = 1500) -> tuple[dict, dict]:
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
    content, _usage = await _chat_completion(messages, json_mode=False, max_tokens=600)
    return content

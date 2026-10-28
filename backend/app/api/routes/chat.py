"""
Endpoint del chat del asistente — reutiliza el mismo pipeline de RAG y el mismo
cliente de modelo que la generación de planes (`app/rag/`, `app/services/llm.py`),
pero en modo texto libre en vez de JSON, y sin guardrails de plan (no aplica:
esto no es un plan nutricional estructurado, es una respuesta conversacional).
"""

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Request, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_database
from app.core.rate_limit import limiter
from app.models.chat import ChatRequest, ChatResponse
from app.models.user import UserBase
from app.rag.knowledge_base import retrieve_relevant_documents
from app.rag.prompt import build_chat_system_prompt
from app.services.llm import LLMError, generate_reply
from app.utils.mongo import doc_to_dict

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
@limiter.limit("20/hour")
async def send_chat_message(request: Request, payload: ChatRequest, db: AsyncIOMotorDatabase = Depends(get_database)):
    try:
        object_id = ObjectId(payload.user_id)
    except InvalidId:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="user_id inválido")

    user_doc = await db.users.find_one({"_id": object_id})
    if user_doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    user = UserBase(**doc_to_dict(user_doc))

    latest_plan_doc = await db.plans.find_one({"user_id": payload.user_id}, sort=[("_id", -1)])

    knowledge_documents = retrieve_relevant_documents(user.clinical_profile.pathologies)
    system_prompt = build_chat_system_prompt(user, knowledge_documents, latest_plan_doc)

    conversation = [{"role": m.role, "content": m.content} for m in payload.messages]

    try:
        reply = await generate_reply(system_prompt, conversation)
    except LLMError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    return ChatResponse(reply=reply)

"""
Consejos puntuales de una sola pregunta ("Tengo una salida con amigos" y
"Ajustar por presupuesto/disponibilidad") — reutilizan la misma recuperación de
fichas clínicas y el mismo modelo que el chat y la generación de planes, pero
como una respuesta corta y directa en vez de una conversación de varios turnos.
"""

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Request, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_database
from app.core.rate_limit import limiter
from app.models.advice import AdviceRequest, AdviceResponse
from app.models.user import UserBase
from app.rag.knowledge_base import retrieve_relevant_documents
from app.rag.prompt import BUDGET_INTRO, SOCIAL_EVENT_INTRO, build_advice_system_prompt
from app.services.llm import LLMError, generate_reply
from app.utils.mongo import doc_to_dict

router = APIRouter(prefix="/api/advice", tags=["advice"])


async def _get_advice(db: AsyncIOMotorDatabase, payload: AdviceRequest, intro: str) -> AdviceResponse:
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
    system_prompt = build_advice_system_prompt(intro, user, knowledge_documents, latest_plan_doc)

    try:
        reply = await generate_reply(system_prompt, [{"role": "user", "content": payload.situation}])
    except LLMError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    return AdviceResponse(advice=reply)


@router.post("/social-event", response_model=AdviceResponse)
@limiter.limit("10/hour")
async def social_event_advice(request: Request, payload: AdviceRequest, db: AsyncIOMotorDatabase = Depends(get_database)):
    """'Tengo una salida con amigos' — consejo para comer fuera sin salirse
    del todo del plan, y cómo compensar el resto del día."""
    return await _get_advice(db, payload, SOCIAL_EVENT_INTRO)


@router.post("/budget", response_model=AdviceResponse)
@limiter.limit("10/hour")
async def budget_advice(request: Request, payload: AdviceRequest, db: AsyncIOMotorDatabase = Depends(get_database)):
    """'Ajustar por presupuesto/disponibilidad' — sustituciones de alimentos
    por grupo nutricional según lo que el usuario tenga disponible o quiera gastar."""
    return await _get_advice(db, payload, BUDGET_INTRO)

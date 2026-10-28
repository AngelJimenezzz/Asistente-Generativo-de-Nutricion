from datetime import date

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Request, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import ValidationError

from app.api.deps import get_database
from app.core.rate_limit import limiter
from app.guardrails.engine import run_guardrails
from app.guardrails.schemas import GuardrailReport
from app.models.plan import Meal, PlanCreate, PlanOut
from app.models.user import UserBase
from app.rag.knowledge_base import retrieve_relevant_documents
from app.rag.prompt import (
    MEAL_SWAP_SYSTEM_PROMPT,
    SYSTEM_PROMPT,
    build_meal_swap_prompt,
    build_user_prompt,
)
from app.services.llm import LLMError, generate_json
from app.utils.mongo import doc_to_dict

_SPANISH_WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

router = APIRouter(prefix="/api/plans", tags=["plans"])


def _iso_week_id(d: date) -> str:
    """Identificador determinista de la semana calendario (ej. '2026-W40').
    Todos los días generados dentro de la misma semana comparten este id de
    forma automática, sin necesidad de generarlos todos de una vez."""
    iso_year, iso_week, _ = d.isocalendar()
    return f"{iso_year}-W{iso_week:02d}"


async def _get_user_document(db: AsyncIOMotorDatabase, user_id: str) -> dict:
    try:
        object_id = ObjectId(user_id)
    except InvalidId:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="user_id inválido")

    user_doc = await db.users.find_one({"_id": object_id})
    if user_doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return user_doc


@router.post("/validate", response_model=GuardrailReport)
async def validate_plan(payload: PlanCreate, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Corre los guardrails clínicos sobre un plan sin guardarlo.

    Pensado para que el futuro motor de IA (Fase 3: fine-tuning + RAG) valide
    su propia salida antes de persistirla o mostrarla al usuario.
    """
    user_doc = await _get_user_document(db, payload.user_id)
    pathologies = user_doc.get("clinical_profile", {}).get("pathologies")
    return run_guardrails(payload, pathologies=pathologies)


@router.post("", response_model=PlanOut, status_code=status.HTTP_201_CREATED)
async def create_plan(payload: PlanCreate, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Crea un plan directamente (sin pasar por el motor de IA).

    Útil para poblar datos de prueba y para casos donde no se quiera gastar una
    llamada al modelo generativo (ver `POST /api/plans/generate` para eso). Aun
    así, todo plan pasa por los guardrails clínicos antes de guardarse — esa
    capa de seguridad no depende de que exista un LLM detrás.
    """
    user_doc = await _get_user_document(db, payload.user_id)
    pathologies = user_doc.get("clinical_profile", {}).get("pathologies")

    report = run_guardrails(payload, pathologies=pathologies)
    if not report.passed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "El plan no pasó los guardrails clínicos y no fue guardado.",
                "violations": [v.model_dump(by_alias=True) for v in report.violations],
            },
        )

    document = payload.model_dump()
    result = await db.plans.insert_one(document)
    created = await db.plans.find_one({"_id": result.inserted_id})
    return PlanOut(**doc_to_dict(created))


@router.get("/user/{user_id}", response_model=list[PlanOut])
async def list_plans_for_user(user_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    cursor = db.plans.find({"user_id": user_id}).sort("_id", -1)
    documents = await cursor.to_list(length=100)
    return [PlanOut(**doc_to_dict(doc)) for doc in documents]


@router.get("/week/{user_id}", response_model=list[PlanOut])
async def get_latest_week(user_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Devuelve los días de la semana más reciente generada para el usuario,
    ordenados por día (1 = hoy). Si el plan más reciente no tiene `weekId`
    (viene de "Generar plan de prueba", un plan suelto de un día), devuelve
    solo ese plan."""
    latest = await db.plans.find_one({"user_id": user_id}, sort=[("_id", -1)])
    if latest is None:
        return []

    week_id = latest.get("week_id")
    if week_id is None:
        return [PlanOut(**doc_to_dict(latest))]

    cursor = db.plans.find({"user_id": user_id, "week_id": week_id}).sort("day_index", 1)
    documents = await cursor.to_list(length=7)
    return [PlanOut(**doc_to_dict(doc)) for doc in documents]


@router.get("/{plan_id}", response_model=PlanOut)
async def get_plan(plan_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    try:
        object_id = ObjectId(plan_id)
    except InvalidId:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="plan_id inválido")

    document = await db.plans.find_one({"_id": object_id})
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan no encontrado")

    return PlanOut(**doc_to_dict(document))


@router.post("/generate", response_model=list[PlanOut], status_code=status.HTTP_201_CREATED)
@limiter.limit("5/hour")
async def generate_plan(request: Request, user_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Genera el plan de HOY con IA: RAG (fichas clínicas relevantes) + Llama
    3.3 70B (Together.ai) + los mismos guardrails deterministas que ya validan
    los planes creados a mano.

    A propósito, esto genera SOLO el día de hoy, nunca días futuros — la idea
    es que la app se use todos los días (cada día trae su propio plan nuevo),
    no que se pueda generar toda la semana de un jalón y no volver a entrar.
    Cada día generado se agrupa automáticamente bajo la semana calendario a la
    que pertenece (`week_id`), así que si el usuario entra varios días
    seguidos, `GET /api/plans/week/{user_id}` va mostrando la semana
    acumulándose día por día.

    El modelo usado aquí (Llama 3.3 70B, el único de la familia Llama que
    Together ofrece en modo serverless) es distinto al que se afinará con
    QLoRA en Fase 3 parte 2 (Llama 3.1 8B, vía Hugging Face + Colab) — ver
    `app/services/llm.py` para el porqué. Esta ruta es sobre el pipeline RAG,
    no sobre el modelo fino-ajustado.
    """
    user_doc = await _get_user_document(db, user_id)
    user = UserBase(**doc_to_dict(user_doc))

    knowledge_documents = retrieve_relevant_documents(user.clinical_profile.pathologies)
    user_prompt = build_user_prompt(user, knowledge_documents)

    try:
        raw_plan = await generate_json(SYSTEM_PROMPT, user_prompt)
    except LLMError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    today = date.today()
    raw_plan["userId"] = user_id
    raw_plan["weekId"] = _iso_week_id(today)
    raw_plan["dayIndex"] = today.isoweekday()  # 1 = lunes ... 7 = domingo
    raw_plan["dayOfWeek"] = _SPANISH_WEEKDAYS[today.weekday()]

    # Los LLM son poco confiables haciendo aritmética exacta: suelen declarar
    # unas calorías que no cuadran con sus propios macros, y eso hace que el
    # guardrail de consistencia los rechace seguido. En vez de esperar a que
    # el modelo sume bien, se recalculan aquí a partir de sus macros — así esa
    # verificación siempre cuadra por construcción.
    macros = raw_plan.get("macros") or {}
    if all(k in macros for k in ("protein", "carbs", "fat")):
        raw_plan["calories"] = macros["protein"] * 4 + macros["carbs"] * 4 + macros["fat"] * 9

    try:
        plan = PlanCreate(**raw_plan)
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"El modelo no devolvió un plan con la forma esperada: {exc}",
        ) from exc

    report = run_guardrails(plan, pathologies=user.clinical_profile.pathologies)
    if not report.passed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "El plan generado por IA no pasó los guardrails clínicos y no fue guardado.",
                "violations": [v.model_dump(by_alias=True) for v in report.violations],
            },
        )

    # Reemplaza el plan de HOY si ya existía (ej. el usuario le dio "generar
    # otra vez") — nunca duplica el mismo día.
    document = plan.model_dump()
    await db.plans.update_one(
        {"user_id": user_id, "week_id": plan.week_id, "day_index": plan.day_index},
        {"$set": document},
        upsert=True,
    )

    cursor = db.plans.find({"user_id": user_id, "week_id": plan.week_id}).sort("day_index", 1)
    created = await cursor.to_list(length=7)
    return [PlanOut(**doc_to_dict(doc)) for doc in created]


@router.post("/{plan_id}/meals/{meal_id}/swap", response_model=PlanOut)
@limiter.limit("10/hour")
async def swap_meal(request: Request, plan_id: str, meal_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Reemplaza UNA sola comida de un día ya generado, sin tocar el resto.

    Pensado para cuando al usuario no le gustó una comida en particular y no
    quiere perder las demás ni gastar una llamada completa regenerando todo el
    día. Las calorías/macros del día se dejan igual que antes del cambio — el
    plan no tiene nutrición por alimento (eso depende de OpenFoodFacts, no
    integrado con los guardrails todavía), así que recalcularlas a partir de
    una sola comida cambiada no sería más preciso que dejarlas como estaban.
    """
    try:
        object_id = ObjectId(plan_id)
    except InvalidId:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="plan_id inválido")

    plan_doc = await db.plans.find_one({"_id": object_id})
    if plan_doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan no encontrado")

    plan = PlanCreate(**doc_to_dict(plan_doc))
    meal_index = next((i for i, m in enumerate(plan.meals) if m.id == meal_id), None)
    if meal_index is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comida no encontrada en este plan")
    current_meal = plan.meals[meal_index]

    user_doc = await _get_user_document(db, plan.user_id)
    user = UserBase(**doc_to_dict(user_doc))

    knowledge_documents = retrieve_relevant_documents(user.clinical_profile.pathologies)
    user_prompt = build_meal_swap_prompt(user, knowledge_documents, current_meal.name, current_meal.items)

    try:
        raw_meal = await generate_json(MEAL_SWAP_SYSTEM_PROMPT, user_prompt, max_tokens=500)
    except LLMError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    raw_meal["id"] = meal_id
    try:
        new_meal = Meal(**raw_meal)
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"El modelo no devolvió una comida con la forma esperada: {exc}",
        ) from exc

    updated_meals = list(plan.meals)
    updated_meals[meal_index] = new_meal
    updated_plan = plan.model_copy(update={"meals": updated_meals})

    report = run_guardrails(updated_plan, pathologies=user.clinical_profile.pathologies)
    if not report.passed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "La comida generada no pasó los guardrails clínicos y no fue guardada.",
                "violations": [v.model_dump(by_alias=True) for v in report.violations],
            },
        )

    await db.plans.update_one({"_id": object_id}, {"$set": updated_plan.model_dump()})
    updated_doc = await db.plans.find_one({"_id": object_id})
    return PlanOut(**doc_to_dict(updated_doc))

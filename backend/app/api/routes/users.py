from datetime import date

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_database
from app.guardrails.engine import run_profile_guardrails
from app.models.user import UserCreate, UserOut, UserUpdate
from app.utils.mongo import doc_to_dict
from app.utils.streak import compute_next_streak

router = APIRouter(prefix="/api/users", tags=["users"])


def _check_profile_guardrails(payload: UserCreate | UserUpdate) -> None:
    report = run_profile_guardrails(payload)
    if not report.passed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "El perfil no pasó los guardrails clínicos y no fue guardado.",
                "violations": [v.model_dump(by_alias=True) for v in report.violations],
            },
        )


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(payload: UserCreate, db: AsyncIOMotorDatabase = Depends(get_database)):
    _check_profile_guardrails(payload)

    document = payload.model_dump()
    document["streak_days"] = 0
    result = await db.users.insert_one(document)
    created = await db.users.find_one({"_id": result.inserted_id})
    return UserOut(**doc_to_dict(created))


@router.get("/{user_id}", response_model=UserOut)
async def get_user(user_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    try:
        object_id = ObjectId(user_id)
    except InvalidId:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="user_id inválido")

    document = await db.users.find_one({"_id": object_id})
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    return UserOut(**doc_to_dict(document))


@router.put("/{user_id}", response_model=UserOut)
async def update_user(user_id: str, payload: UserUpdate, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Reemplaza el perfil completo del usuario.

    Pensado para el formulario de registro/onboarding: guarda de una sola vez
    todos los módulos del perfil (antropometría, objetivo, clínico, dietético,
    estilo de vida, flexibilidad) y marca `onboardingComplete = true`.
    """
    try:
        object_id = ObjectId(user_id)
    except InvalidId:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="user_id inválido")

    existing = await db.users.find_one({"_id": object_id})
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    _check_profile_guardrails(payload)

    document = payload.model_dump()
    document["streak_days"] = existing.get("streak_days", 0)
    await db.users.update_one({"_id": object_id}, {"$set": document})

    updated = await db.users.find_one({"_id": object_id})
    return UserOut(**doc_to_dict(updated))


@router.post("/{user_id}/checkin", response_model=UserOut)
async def checkin(user_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Se llama una vez cuando el usuario abre la app — actualiza su racha de
    días CONSECUTIVOS de uso. Es la única forma en que la racha cambia.

    Principio de diseño no negociable del proyecto: la constancia se mide
    por USO de la app, nunca por peso ni medidas corporales, y no tiene
    medallas/logros ni comparación con otros usuarios — solo este número.
    """
    try:
        object_id = ObjectId(user_id)
    except InvalidId:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="user_id inválido")

    existing = await db.users.find_one({"_id": object_id})
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    today = date.today()
    new_streak = compute_next_streak(
        current_streak=existing.get("streak_days", 0) or 0,
        last_active_iso=existing.get("last_active_date"),
        today=today,
    )

    await db.users.update_one(
        {"_id": object_id},
        {"$set": {"streak_days": new_streak, "last_active_date": today.isoformat()}},
    )
    updated = await db.users.find_one({"_id": object_id})
    return UserOut(**doc_to_dict(updated))

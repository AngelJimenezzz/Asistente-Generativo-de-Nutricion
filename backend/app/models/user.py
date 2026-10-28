from pydantic import Field

from app.models.base import CamelModel


class Anthropometrics(CamelModel):
    """Datos usados por el backend para calcular TMB y gasto energético (Fase 3)."""

    age: int | None = Field(default=None, ge=1, le=120)
    biological_sex: str | None = Field(default=None, description="'femenino' o 'masculino' — necesario para fórmulas metabólicas")
    height_cm: float | None = Field(default=None, gt=0)
    weight_kg: float | None = Field(default=None, gt=0)


class ActivityLevel(CamelModel):
    work_activity: str | None = Field(default=None, description="sedentario | de_pie | trabajo_fisico")
    exercise_days_per_week: int | None = Field(default=None, ge=0, le=7)
    exercise_type: str | None = None


class GoalProfile(CamelModel):
    primary_goal: str | None = Field(
        default=None,
        description="perdida_grasa | ganancia_muscular | recomposicion | mantenimiento | rendimiento_deportivo | control_salud",
    )
    progress_speed: str | None = Field(
        default=None,
        description="lento | moderado | agresivo — 'agresivo' se bloquea si hay condiciones clínicas (ver guardrails)",
    )


class ClinicalProfile(CamelModel):
    """Perfil clínico declarado por el usuario.

    `current_medications` y `symptoms_notes` se guardan como datos simples.
    Intencionalmente NO se procesan ni interpretan de forma automática todavía
    — hacerlo (ej. NER sobre síntomas, chequeo de interacciones fármaco-nutriente)
    es una decisión clínica real que corresponde a la Fase 3 con supervisión,
    no a un guardrail determinista sin respaldo profesional.
    """

    pathologies: list[str] = Field(
        default_factory=list,
        description="diabetes_tipo_1 | diabetes_tipo_2 | resistencia_insulina | hipertension | sop | hipotiroidismo | higado_graso | enfermedad_renal",
    )
    digestive_conditions: list[str] = Field(
        default_factory=list, description="sensibilidad_gluten | sii_fodmap | reflujo"
    )
    current_medications: list[str] = Field(default_factory=list)
    symptoms_notes: str | None = Field(
        default=None,
        description="Texto libre del usuario. Solo se almacena; no dispara reglas automáticas.",
    )


class DislikedFood(CamelModel):
    barcode: str | None = None
    name: str


class DietaryProfile(CamelModel):
    allergies: list[str] = Field(
        default_factory=list,
        description="Restricción dura: cacahuates | nueces | mariscos | huevo | lacteos | soya | gluten | ...",
    )
    diet_philosophy: str | None = Field(
        default=None, description="omnivoro | vegetariano | vegano | pescetariano | keto | ayuno_intermitente"
    )
    disliked_foods: list[DislikedFood] = Field(default_factory=list)


class LifestyleProfile(CamelModel):
    budget_tier: str | None = Field(default=None, description="economico | estandar | premium")
    kitchen_equipment: list[str] = Field(
        default_factory=list, description="licuadora | horno | microondas | freidora_aire | estufa"
    )
    cooking_time: str | None = Field(default=None, description="menos_15_min | 30_min | tengo_tiempo")
    meals_per_day: int | None = Field(default=None, ge=1, le=6)
    region: str | None = Field(
        default=None,
        description="País declarado por el usuario (no estado/provincia) — para adaptar la gastronomía sugerida",
    )


class FlexibilityProfile(CamelModel):
    strictness: str | None = Field(default=None, description="flexible | moderado | estricto")
    flavor_preference: str | None = Field(default=None, description="dulce | salado | ambos")


class UserBase(CamelModel):
    name: str
    anthropometrics: Anthropometrics = Field(default_factory=Anthropometrics)
    activity_level: ActivityLevel = Field(default_factory=ActivityLevel)
    goal_profile: GoalProfile = Field(default_factory=GoalProfile)
    clinical_profile: ClinicalProfile = Field(default_factory=ClinicalProfile)
    dietary_profile: DietaryProfile = Field(default_factory=DietaryProfile)
    lifestyle_profile: LifestyleProfile = Field(default_factory=LifestyleProfile)
    flexibility_profile: FlexibilityProfile = Field(default_factory=FlexibilityProfile)
    onboarding_complete: bool = False


class UserCreate(UserBase):
    pass


class UserUpdate(UserBase):
    pass


class UserOut(UserBase):
    id: str
    streak_days: int = 0

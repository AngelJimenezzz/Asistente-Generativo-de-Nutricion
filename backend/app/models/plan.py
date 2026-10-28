from pydantic import Field

from app.models.base import CamelModel


class Macros(CamelModel):
    protein: float = Field(ge=0)
    carbs: float = Field(ge=0)
    fat: float = Field(ge=0)


class Meal(CamelModel):
    id: str
    name: str
    items: list[str] = Field(min_length=1)
    why: str = Field(
        min_length=1,
        description="Explicación clínica de por qué se eligió esta comida — explicabilidad no negociable",
    )


class PlanBase(CamelModel):
    user_id: str
    calories: float = Field(gt=0)
    macros: Macros
    meals: list[Meal] = Field(min_length=1)
    # Un plan es "un día". Un plan semanal son 7 de estos documentos que
    # comparten week_id. Quedan opcionales para no romper la creación manual
    # de un plan suelto (POST /api/plans, usado por "Generar plan de prueba").
    week_id: str | None = Field(default=None, description="Agrupa los 7 días de una misma semana generada")
    day_index: int | None = Field(default=None, ge=1, le=7, description="1 = hoy, 2 = mañana, ... 7")
    day_of_week: str | None = Field(default=None, description="Nombre real del día calculado por el backend, ej. 'Lunes'")


class PlanCreate(PlanBase):
    pass


class PlanOut(PlanBase):
    id: str

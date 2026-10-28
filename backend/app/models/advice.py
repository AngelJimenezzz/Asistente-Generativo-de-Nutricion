from pydantic import Field

from app.models.base import CamelModel


class AdviceRequest(CamelModel):
    user_id: str
    situation: str = Field(min_length=1, description="Descripción libre de la situación del usuario")


class AdviceResponse(CamelModel):
    advice: str

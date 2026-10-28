from pydantic import Field

from app.models.base import CamelModel


class ChatMessage(CamelModel):
    role: str = Field(description="'user' o 'assistant'")
    content: str


class ChatRequest(CamelModel):
    user_id: str
    messages: list[ChatMessage] = Field(min_length=1, description="Historial completo de la conversación")


class ChatResponse(CamelModel):
    reply: str

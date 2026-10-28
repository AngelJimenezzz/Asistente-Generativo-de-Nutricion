from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.api.routes import advice, chat, foods, health, plans, users
from app.core.config import get_settings
from app.core.rate_limit import limiter
from app.db.mongodb import close_mongo_connection, connect_to_mongo, database


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    app.state.db = database.db
    yield
    await close_mongo_connection()


settings = get_settings()

app = FastAPI(
    title="Asistente Generativo de Nutrición de Precisión — API",
    version="0.1.0",
    lifespan=lifespan,
)

app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    # Mismo formato ({"detail": "..."}) que el resto de los errores del
    # backend, para que el cliente de la app muestre un mensaje legible en
    # vez de un "Error 429" genérico.
    return JSONResponse(
        status_code=429,
        content={"detail": "Demasiadas solicitudes a la IA desde esta red en poco tiempo. Espera un momento e intenta de nuevo."},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(users.router)
app.include_router(plans.router)
app.include_router(foods.router)
app.include_router(chat.router)
app.include_router(advice.router)

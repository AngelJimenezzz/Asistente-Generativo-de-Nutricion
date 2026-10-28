"""
Endpoints de alimentos — Actividad 1 de la tesis.

Expone la base de datos de alimentos de OpenFoodFacts al resto del sistema.
El motor de IA (Fase 3) usará estos endpoints para validar que los alimentos
que sugiere existen realmente y para obtener sus valores nutricionales reales,
en lugar de que el LLM los invente.
"""

from fastapi import APIRouter, HTTPException, Query, Request

from app.services.openfoodfacts import (
    OpenFoodFactsClient,
    OpenFoodFactsError,
)

router = APIRouter(prefix="/api/foods", tags=["foods"])


def _client(request: Request) -> OpenFoodFactsClient:
    """Construye el cliente reutilizando la conexión de Mongo de la app."""
    db = getattr(request.app.state, "db", None)
    return OpenFoodFactsClient(db=db)


@router.get("/barcode/{barcode}")
async def get_food_by_barcode(barcode: str, request: Request):
    """
    Consulta un alimento por su código de barras.

    Pensado para el escaneo de productos desde la app móvil.
    """
    if not barcode.isdigit() or not (8 <= len(barcode) <= 14):
        raise HTTPException(
            status_code=400,
            detail="Código de barras inválido: debe tener entre 8 y 14 dígitos.",
        )

    try:
        product = await _client(request).get_by_barcode(barcode)
    except OpenFoodFactsError as exc:
        # Degradación segura: si OFF no responde, se informa explícitamente
        # en vez de devolver datos nutricionales inventados o incompletos.
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    if product is None:
        raise HTTPException(
            status_code=404,
            detail=f"El producto {barcode} no existe en la base de OpenFoodFacts.",
        )

    return product


@router.get("/search")
async def search_foods(
    request: Request,
    q: str = Query(..., min_length=2, description="Texto a buscar, ej. 'avena'"),
    limit: int = Query(10, ge=1, le=25),
):
    """
    Búsqueda de alimentos por texto libre.

    Nota: OpenFoodFacts limita estas consultas a ~10 por minuto por IP, por lo que
    este endpoint NO debe llamarse mientras el usuario escribe (search-as-you-type).
    La app debe esperar a que el usuario confirme el término de búsqueda.
    """
    try:
        products = await _client(request).search_by_text(q, page_size=limit)
    except OpenFoodFactsError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    usable = [p for p in products if p["has_minimum_nutrition_data"]]

    return {
        "query": q,
        "total": len(products),
        "usable": len(usable),
        "products": products,
        "note": (
            "'usable' cuenta los productos con datos nutricionales completos "
            "(energía, proteína, carbohidratos y grasa). Los datos de OpenFoodFacts "
            "son colaborativos y su completitud varía entre productos."
        ),
    }


@router.get("/category/{category}")
async def search_by_category(
    category: str,
    request: Request,
    limit: int = Query(10, ge=1, le=25),
):
    """
    Búsqueda estructurada por categoría de alimento.

    Este es el endpoint que usará el motor de IA en Fase 3: el modelo sugiere una
    categoría ("breakfast cereals") y el backend devuelve productos reales de esa
    categoría, evitando que el LLM invente marcas o valores nutricionales.
    """
    try:
        products = await _client(request).search_by_category(category, page_size=limit)
    except OpenFoodFactsError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return {
        "category": category,
        "total": len(products),
        "products": products,
    }

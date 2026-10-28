"""
Cliente de la API de OpenFoodFacts (OFF).

Actividad 1 de la tesis — "Recopilación y Curación de Datos": conexión con la API
de OpenFoodFacts para garantizar una base de datos de alimentos actualizada.

Decisiones de diseño (documentadas para la tesis):

1. **Caché obligatorio en MongoDB.** OFF limita a ~10 req/min/IP las consultas de
   búsqueda. Sin caché, la app se bloquearía con pocos usuarios concurrentes.
   Los datos nutricionales de un producto cambian con muy baja frecuencia, así que
   un TTL de 7 días es seguro y reduce drásticamente las llamadas salientes.

2. **Dos endpoints según el tipo de consulta.** La API v2 NO soporta búsqueda por
   texto libre (solo filtros estructurados por categoría/marca/nutrientes). Para
   que el usuario pueda escribir "avena" hay que usar el endpoint heredado v1
   (/cgi/search.pl). Se usa v2 para código de barras y filtros; v1 para texto.

3. **Selección explícita de campos (`fields=`).** Un registro completo de OFF puede
   superar los 200 KB. Pedimos solo los campos que el motor nutricional necesita.

4. **User-Agent identificable.** OFF lo solicita explícitamente a los reusuarios de
   la API para poder contactar al desarrollador si hay un problema.

5. **Instancia de México por defecto, con reintento automático a la mundial.**
   `mx.openfoodfacts.org` prioriza productos disponibles en el mercado mexicano,
   coherente con el impacto social del proyecto. Pero es una instancia regional
   más pequeña que puede caerse de forma independiente del resto de OFF (se
   observó esto en la práctica: `mx.openfoodfacts.org` devolviendo 503 mientras
   `world.openfoodfacts.org` respondía normal) — por eso, si la instancia
   configurada falla, el cliente reintenta automáticamente contra
   `world.openfoodfacts.org` antes de reportar error.

Licencia de los datos: Open Database License (ODbL). Requiere atribución a
Open Food Facts en la aplicación.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

# ── Configuración ────────────────────────────────────────────────────────────

OFF_BASE_MX = "https://mx.openfoodfacts.org"
OFF_BASE_WORLD = "https://world.openfoodfacts.org"

USER_AGENT = (
    "AsistenteNutricionPrecision/0.1 "
    "(Tesis - Universidad de Colima, Facultad de Telematica; "
    "https://github.com/AngelJimenezzz/Asistente-Generativo-de-Nutricion)"
)

# Campos mínimos que necesita el motor nutricional. Pedir solo estos evita
# descargar registros de cientos de KB por producto.
PRODUCT_FIELDS = ",".join([
    "code",
    "product_name",
    "product_name_es",
    "brands",
    "quantity",
    "serving_size",
    "categories_tags_en",
    "nutriments",
    "nutriscore_grade",
    "nova_group",
    "allergens_tags",
    "ingredients_text_es",
    "ingredients_text",
    "countries_tags_en",
    "image_front_small_url",
])

CACHE_TTL_DAYS = 7
REQUEST_TIMEOUT = 10.0
MAX_RETRIES = 2


class OpenFoodFactsError(Exception):
    """Error al consultar la API de OpenFoodFacts."""


# ── Normalización ────────────────────────────────────────────────────────────

def _num(value: Any) -> Optional[float]:
    """Convierte a float o devuelve None. OFF a veces manda strings o vacíos."""
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def normalize_product(raw: dict) -> dict:
    """
    Convierte un producto crudo de OFF al esquema interno del proyecto.

    Los datos de OFF son colaborativos, por lo que la completitud varía mucho entre
    productos. Esta función normaliza a un esquema estable y marca explícitamente
    qué campos faltan, para que los guardrails puedan rechazar un alimento sin
    información nutricional suficiente en vez de asumir ceros.
    """
    nutriments = raw.get("nutriments") or {}

    # OFF expone valores por 100g y por porción. Usamos por 100g como base
    # canónica porque siempre está presente cuando hay datos nutricionales.
    normalized = {
        "barcode": raw.get("code"),
        "name": (
            raw.get("product_name_es")
            or raw.get("product_name")
            or "Producto sin nombre"
        ),
        "brand": raw.get("brands"),
        "quantity": raw.get("quantity"),
        "serving_size": raw.get("serving_size"),
        "categories": raw.get("categories_tags_en") or [],
        "allergens": raw.get("allergens_tags") or [],
        "ingredients_text": (
            raw.get("ingredients_text_es") or raw.get("ingredients_text")
        ),
        "nutriscore": raw.get("nutriscore_grade"),
        "nova_group": raw.get("nova_group"),
        "image_url": raw.get("image_front_small_url"),
        "countries": raw.get("countries_tags_en") or [],
        # Valores nutricionales por 100 g / 100 ml
        "nutrition_per_100g": {
            "energy_kcal": _num(nutriments.get("energy-kcal_100g")),
            "protein_g": _num(nutriments.get("proteins_100g")),
            "carbohydrates_g": _num(nutriments.get("carbohydrates_100g")),
            "sugars_g": _num(nutriments.get("sugars_100g")),
            "fat_g": _num(nutriments.get("fat_100g")),
            "saturated_fat_g": _num(nutriments.get("saturated-fat_100g")),
            "fiber_g": _num(nutriments.get("fiber_100g")),
            "sodium_mg": (
                _num(nutriments.get("sodium_100g")) * 1000
                if _num(nutriments.get("sodium_100g")) is not None
                else None
            ),
            "salt_g": _num(nutriments.get("salt_100g")),
        },
        "source": "openfoodfacts",
        "fetched_at": datetime.now(timezone.utc),
    }

    # Bandera de calidad: sin estos tres campos el alimento no es utilizable
    # para calcular un plan nutricional con garantías.
    n = normalized["nutrition_per_100g"]
    normalized["has_minimum_nutrition_data"] = all(
        n[k] is not None for k in ("energy_kcal", "protein_g", "carbohydrates_g", "fat_g")
    )

    return normalized


# ── Cliente ──────────────────────────────────────────────────────────────────

class OpenFoodFactsClient:
    """
    Cliente asíncrono de OFF con caché en MongoDB.

    Uso:
        client = OpenFoodFactsClient(db)
        producto = await client.get_by_barcode("7501055310517")
        resultados = await client.search_by_text("avena")
    """

    def __init__(self, db=None, base_url: str = OFF_BASE_MX):
        self.db = db
        self.base_url = base_url
        self._headers = {"User-Agent": USER_AGENT}

    # ── Caché ────────────────────────────────────────────────────────────────

    @property
    def _cache(self):
        if self.db is None:
            return None
        return self.db["food_cache"]

    async def _cache_get(self, barcode: str) -> Optional[dict]:
        if self._cache is None:
            return None
        cutoff = datetime.now(timezone.utc) - timedelta(days=CACHE_TTL_DAYS)
        doc = await self._cache.find_one({
            "barcode": barcode,
            "fetched_at": {"$gte": cutoff},
        })
        if doc:
            doc.pop("_id", None)
            logger.info("Cache HIT para %s", barcode)
        return doc

    async def _cache_put(self, product: dict) -> None:
        if self._cache is None or not product.get("barcode"):
            return
        await self._cache.update_one(
            {"barcode": product["barcode"]},
            {"$set": product},
            upsert=True,
        )

    # ── Peticiones HTTP ──────────────────────────────────────────────────────

    async def _request_from(self, base_url: str, path: str, params: dict) -> dict:
        url = f"{base_url}{path}"
        last_error: Optional[Exception] = None
        for attempt in range(MAX_RETRIES + 1):
            try:
                async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as http:
                    resp = await http.get(url, params=params, headers=self._headers)
                    if resp.status_code == 429:
                        # Rate limit de OFF: espera exponencial antes de reintentar.
                        wait = 2 ** attempt
                        logger.warning("OFF rate limit (429), esperando %ss", wait)
                        await asyncio.sleep(wait)
                        continue
                    resp.raise_for_status()
                    return resp.json()
            except (httpx.HTTPError, ValueError) as exc:
                last_error = exc
                logger.warning("Error consultando OFF (intento %s) en %s: %s", attempt + 1, base_url, exc)
                if attempt < MAX_RETRIES:
                    await asyncio.sleep(1)
        raise OpenFoodFactsError(f"No se pudo consultar OpenFoodFacts en {base_url}: {last_error}")

    async def _request(self, path: str, params: dict) -> dict:
        """
        Intenta primero contra self.base_url (por defecto, la instancia de
        México). Si esa instancia específica falla (ej. una caída puntual de
        mx.openfoodfacts.org, ya observado en producción), reintenta contra la
        instancia mundial antes de rendirse — misma base de datos de productos,
        solo sin la priorización regional.
        """
        try:
            return await self._request_from(self.base_url, path, params)
        except OpenFoodFactsError as primary_error:
            if self.base_url == OFF_BASE_WORLD:
                raise
            logger.warning(
                "Instancia %s no disponible, reintentando con la instancia mundial", self.base_url
            )
            try:
                return await self._request_from(OFF_BASE_WORLD, path, params)
            except OpenFoodFactsError:
                raise primary_error

    # ── API pública ──────────────────────────────────────────────────────────

    async def get_by_barcode(self, barcode: str) -> Optional[dict]:
        """
        Obtiene un producto por código de barras (API v2).

        Devuelve None si el producto no existe en la base de OFF.
        """
        cached = await self._cache_get(barcode)
        if cached:
            return cached

        data = await self._request(f"/api/v2/product/{barcode}.json", {"fields": PRODUCT_FIELDS})

        # OFF devuelve status 0 cuando el producto no existe.
        if data.get("status") == 0 or not data.get("product"):
            logger.info("Producto %s no encontrado en OFF", barcode)
            return None

        product = normalize_product(data["product"])
        await self._cache_put(product)
        return product

    async def search_by_text(self, query: str, page_size: int = 10) -> list[dict]:
        """
        Búsqueda por texto libre (endpoint heredado v1).

        La API v2 no soporta búsqueda por texto libre — solo filtros estructurados —
        por lo que para permitir que el usuario escriba "avena" se usa /cgi/search.pl.
        OFF limita estas consultas a ~10/min por IP, así que este método NO debe
        usarse para búsqueda mientras el usuario escribe (search-as-you-type).
        """
        params = {
            "search_terms": query,
            "search_simple": 1,
            "action": "process",
            "json": 1,
            "page_size": page_size,
            "fields": PRODUCT_FIELDS,
        }
        data = await self._request("/cgi/search.pl", params)
        products = [normalize_product(p) for p in data.get("products", [])]

        # Cachea cada resultado para futuras consultas por código de barras.
        for product in products:
            await self._cache_put(product)

        return products

    async def search_by_category(
        self, category: str, page_size: int = 10
    ) -> list[dict]:
        """
        Búsqueda estructurada por categoría (API v2).

        Preferible sobre la búsqueda por texto cuando el motor de IA sugiere una
        categoría de alimento ("cereales de desayuno") en vez de un producto
        concreto — evita que el LLM invente marcas inexistentes.
        """
        params = {
            "categories_tags_en": category,
            "page_size": page_size,
            "fields": PRODUCT_FIELDS,
        }
        data = await self._request("/api/v2/search", params)
        products = [normalize_product(p) for p in data.get("products", [])]
        for product in products:
            await self._cache_put(product)
        return products

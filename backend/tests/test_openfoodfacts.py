"""
Pruebas de la capa de datos de alimentos (Actividad 1).

Se prueba la normalización con datos crudos simulados de OpenFoodFacts en lugar
de golpear la API real, por dos razones:
  1. OFF limita a ~10 req/min por IP; una suite de pruebas la agotaría.
  2. Las pruebas deben ser deterministas: los datos de OFF son colaborativos y
     pueden cambiar entre ejecuciones.

Se incluye además una prueba de integración marcada, que sí consulta la API real
y se ejecuta solo bajo demanda con:  pytest -m integration
"""

import pytest

from app.services.openfoodfacts import (
    OpenFoodFactsClient,
    normalize_product,
    _num,
)


# ── Datos de prueba ──────────────────────────────────────────────────────────

PRODUCTO_COMPLETO = {
    "code": "7501055310517",
    "product_name": "Avena en hojuelas",
    "product_name_es": "Avena en hojuelas",
    "brands": "Marca Ejemplo",
    "quantity": "400 g",
    "serving_size": "40 g",
    "categories_tags_en": ["en:cereals", "en:breakfast-cereals"],
    "allergens_tags": ["en:gluten"],
    "ingredients_text_es": "Avena integral 100%",
    "nutriscore_grade": "a",
    "nova_group": 1,
    "image_front_small_url": "https://example.org/avena.jpg",
    "countries_tags_en": ["en:mexico"],
    "nutriments": {
        "energy-kcal_100g": 379,
        "proteins_100g": 13.2,
        "carbohydrates_100g": 67.7,
        "sugars_100g": 0.9,
        "fat_100g": 6.5,
        "saturated-fat_100g": 1.1,
        "fiber_100g": 10.1,
        "sodium_100g": 0.006,
        "salt_100g": 0.015,
    },
}

PRODUCTO_INCOMPLETO = {
    "code": "0000000000000",
    "product_name": "Producto sin datos",
    "nutriments": {},
}


# ── Normalización ────────────────────────────────────────────────────────────

def test_normaliza_producto_completo():
    """Un producto con todos los datos se normaliza al esquema interno."""
    p = normalize_product(PRODUCTO_COMPLETO)

    assert p["barcode"] == "7501055310517"
    assert p["name"] == "Avena en hojuelas"
    assert p["brand"] == "Marca Ejemplo"
    assert p["nutriscore"] == "a"
    assert p["source"] == "openfoodfacts"


def test_normaliza_valores_nutricionales():
    """Los valores por 100 g se extraen correctamente."""
    n = normalize_product(PRODUCTO_COMPLETO)["nutrition_per_100g"]

    assert n["energy_kcal"] == 379.0
    assert n["protein_g"] == 13.2
    assert n["carbohydrates_g"] == 67.7
    assert n["fat_g"] == 6.5
    assert n["fiber_g"] == 10.1


def test_convierte_sodio_de_gramos_a_miligramos():
    """
    OFF entrega el sodio en gramos; el sistema trabaja en miligramos porque las
    guías clínicas (OMS, NOM-030) expresan los límites en mg.
    """
    n = normalize_product(PRODUCTO_COMPLETO)["nutrition_per_100g"]
    assert n["sodium_mg"] == pytest.approx(6.0)


def test_marca_producto_completo_como_utilizable():
    """Un producto con energía, proteína, carbohidratos y grasa es utilizable."""
    assert normalize_product(PRODUCTO_COMPLETO)["has_minimum_nutrition_data"] is True


def test_marca_producto_incompleto_como_no_utilizable():
    """
    Un producto sin datos nutricionales NO debe usarse para calcular un plan.
    Esta bandera evita que el sistema asuma ceros y genere un plan inseguro.
    """
    p = normalize_product(PRODUCTO_INCOMPLETO)
    assert p["has_minimum_nutrition_data"] is False
    assert p["nutrition_per_100g"]["energy_kcal"] is None


def test_producto_sin_nombre_recibe_placeholder():
    """Nunca se devuelve un nombre vacío, para no romper la interfaz."""
    p = normalize_product({"code": "123", "nutriments": {}})
    assert p["name"] == "Producto sin nombre"


def test_prefiere_nombre_en_espanol():
    """Si existe el nombre en español, se prioriza sobre el genérico."""
    raw = {
        "code": "123",
        "product_name": "Oat flakes",
        "product_name_es": "Hojuelas de avena",
        "nutriments": {},
    }
    assert normalize_product(raw)["name"] == "Hojuelas de avena"


# ── Conversión numérica ──────────────────────────────────────────────────────

@pytest.mark.parametrize("entrada,esperado", [
    (12.5, 12.5),
    ("12.5", 12.5),
    (0, 0.0),
    (None, None),
    ("", None),
    ("no-es-numero", None),
])
def test_conversion_numerica_tolerante(entrada, esperado):
    """
    OFF a veces entrega strings, vacíos o texto en campos numéricos por ser una
    base colaborativa. La conversión nunca debe lanzar excepción.
    """
    assert _num(entrada) == esperado


# ── Cliente ──────────────────────────────────────────────────────────────────

def test_cliente_usa_instancia_de_mexico_por_defecto():
    """
    Se prioriza mx.openfoodfacts.org para devolver productos disponibles en el
    mercado mexicano, coherente con el objetivo de impacto social del proyecto.
    """
    assert "mx.openfoodfacts.org" in OpenFoodFactsClient().base_url


def test_cliente_sin_db_no_falla():
    """El cliente debe funcionar sin caché (útil en pruebas y scripts)."""
    client = OpenFoodFactsClient(db=None)
    assert client._cache is None


# ── Integración (opcional) ───────────────────────────────────────────────────

@pytest.mark.integration
@pytest.mark.asyncio
async def test_integracion_consulta_real_a_openfoodfacts():
    """
    Consulta real a la API de OpenFoodFacts.

    Ejecutar solo bajo demanda:  pytest -m integration
    Requiere conexión a internet. No se incluye en la suite por defecto para no
    consumir el límite de peticiones de OFF.
    """
    client = OpenFoodFactsClient(db=None)
    producto = await client.get_by_barcode("3017620422003")  # Nutella (ejemplo OFF)

    assert producto is not None
    assert producto["barcode"] == "3017620422003"
    assert producto["nutrition_per_100g"]["energy_kcal"] is not None

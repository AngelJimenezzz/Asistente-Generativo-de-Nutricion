"""
Recuperación (la "R" de RAG) sobre la base de conocimiento clínico curada en
`data/clinical/knowledge_base.json` (Actividad 1 de la tesis).

Decisión de diseño: NO se usa una base de datos vectorial ni embeddings. El
corpus son 12 documentos curados a mano, y cada uno ya viene etiquetado con la
condición clínica a la que aplica (`condicion`: "general" | "diabetes" |
"hipertension" | "renal"). Con un corpus así de pequeño y ya estructurado, una
búsqueda semántica no aporta nada — filtrar por la etiqueta es más simple, más
rápido, y 100% predecible (importante para un guardrail de seguridad clínica).
Si el corpus creciera mucho (cientos de documentos sin etiquetar), ahí sí
justificaría meter embeddings.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

# backend/app/rag/knowledge_base.py -> repo root
_KNOWLEDGE_BASE_PATH = Path(__file__).resolve().parents[3] / "data" / "clinical" / "knowledge_base.json"

# Traduce los slugs de patologías del formulario de registro (ver
# app/models/user.py y app/guardrails/rules.py) a las categorías de la base de
# conocimiento. Varios slugs pueden mapear a la misma categoría clínica.
PATHOLOGY_TO_CATEGORY: dict[str, str] = {
    "diabetes_tipo_1": "diabetes",
    "diabetes_tipo_2": "diabetes",
    "resistencia_insulina": "diabetes",
    "hipertension": "hipertension",
    "enfermedad_renal": "renal",
    # sop, hipotiroidismo e higado_graso no tienen categoría propia todavía en
    # la base de conocimiento — solo reciben los documentos "general".
}


@lru_cache
def _load() -> dict:
    with open(_KNOWLEDGE_BASE_PATH, encoding="utf-8") as f:
        return json.load(f)


def retrieve_relevant_documents(pathologies: list[str] | None) -> list[dict]:
    """
    Devuelve los documentos "general" más los que apliquen a las condiciones
    clínicas declaradas por el usuario (puede tener varias a la vez).
    """
    categories = {"general"}
    for pathology in pathologies or []:
        category = PATHOLOGY_TO_CATEGORY.get(pathology)
        if category:
            categories.add(category)

    documentos = _load()["documentos"]
    return [doc for doc in documentos if doc["condicion"] in categories]

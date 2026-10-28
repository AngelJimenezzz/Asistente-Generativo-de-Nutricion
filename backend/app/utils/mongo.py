from typing import Any


def doc_to_dict(document: dict[str, Any] | None) -> dict[str, Any] | None:
    """Convierte un documento de Mongo (con _id de tipo ObjectId) a un dict
    con 'id' en string, listo para pasar a un modelo Pydantic de salida."""
    if document is None:
        return None
    result = dict(document)
    result["id"] = str(result.pop("_id"))
    return result

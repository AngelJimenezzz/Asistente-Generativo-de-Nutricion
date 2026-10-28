from dataclasses import dataclass


@dataclass(frozen=True)
class ClinicalRule:
    """Límites deterministas por categoría clínica.

    Simplificación intencional: estos límites son solo la primera línea de
    defensa mientras no exista el motor de IA con RAG que razone sobre el
    perfil clínico completo (Fase 3).
    """

    name: str
    max_daily_carbs_g: float | None = None
    max_daily_protein_g: float | None = None


DIABETES_RULE = ClinicalRule(name="diabetes/resistencia a la insulina", max_daily_carbs_g=220)
RENAL_RULE = ClinicalRule(name="enfermedad renal", max_daily_protein_g=90)
DEFAULT_RULE = ClinicalRule(name="general")

# Las patologías llegan como slugs fijos de un checklist (ver app/models/user.py),
# no como texto libre — por eso el match es exacto, no por palabra clave.
PATHOLOGY_RULES: dict[str, ClinicalRule] = {
    "diabetes_tipo_1": DIABETES_RULE,
    "diabetes_tipo_2": DIABETES_RULE,
    "resistencia_insulina": DIABETES_RULE,
    "enfermedad_renal": RENAL_RULE,
}


def resolve_clinical_rules(pathologies: list[str] | None) -> list[ClinicalRule]:
    """Devuelve todas las reglas que aplican. Un usuario puede tener varias
    condiciones a la vez (ej. diabetes Y enfermedad renal) y ambos topes deben
    respetarse."""
    if not pathologies:
        return [DEFAULT_RULE]

    matched: list[ClinicalRule] = []
    for pathology in pathologies:
        rule = PATHOLOGY_RULES.get(pathology)
        if rule is not None and rule not in matched:
            matched.append(rule)

    return matched or [DEFAULT_RULE]

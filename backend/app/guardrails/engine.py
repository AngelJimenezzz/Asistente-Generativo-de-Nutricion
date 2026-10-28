"""Guardrails deterministas — capa de seguridad no negociable del proyecto.

Valida macros, calorías, compatibilidad con la condición clínica y
explicabilidad de un plan ANTES de que se guarde o se muestre al usuario.
No depende de ningún modelo generativo: son reglas fijas en Python/Pydantic,
pensadas para correr tanto sobre planes creados a mano (hoy) como sobre la
salida del motor de IA (Fase 3, cuando exista).
"""

from app.guardrails.rules import DEFAULT_RULE, resolve_clinical_rules
from app.guardrails.schemas import GuardrailReport, GuardrailViolation, Severity
from app.models.plan import PlanBase
from app.models.user import UserBase

MIN_SAFE_CALORIES = 1200
MAX_SAFE_CALORIES = 3500
CALORIE_TOLERANCE = 0.10  # desviación máxima permitida entre macros y calorías declaradas
MIN_WHY_LENGTH = 15


def _check_calorie_bounds(plan: PlanBase) -> list[GuardrailViolation]:
    if plan.calories < MIN_SAFE_CALORIES:
        return [GuardrailViolation(
            code="calories_too_low",
            severity=Severity.BLOCKING,
            message=(
                f"El plan tiene {plan.calories:.0f} kcal, por debajo del mínimo "
                f"seguro de {MIN_SAFE_CALORIES} kcal/día."
            ),
        )]
    if plan.calories > MAX_SAFE_CALORIES:
        return [GuardrailViolation(
            code="calories_too_high",
            severity=Severity.BLOCKING,
            message=(
                f"El plan tiene {plan.calories:.0f} kcal, por encima del máximo "
                f"seguro de {MAX_SAFE_CALORIES} kcal/día."
            ),
        )]
    return []


def _check_macro_consistency(plan: PlanBase) -> list[GuardrailViolation]:
    computed = plan.macros.protein * 4 + plan.macros.carbs * 4 + plan.macros.fat * 9
    deviation = abs(computed - plan.calories) / plan.calories
    if deviation > CALORIE_TOLERANCE:
        return [GuardrailViolation(
            code="macro_calorie_mismatch",
            severity=Severity.BLOCKING,
            message=(
                f"Los macros implican {computed:.0f} kcal, pero el plan declara "
                f"{plan.calories:.0f} kcal (desviación de {deviation:.0%}, "
                f"máximo permitido {CALORIE_TOLERANCE:.0%})."
            ),
        )]
    return []


def _check_explainability(plan: PlanBase) -> list[GuardrailViolation]:
    violations = []
    for meal in plan.meals:
        if not meal.why or len(meal.why.strip()) < MIN_WHY_LENGTH:
            violations.append(GuardrailViolation(
                code="missing_explanation",
                severity=Severity.BLOCKING,
                message=(
                    f"La comida '{meal.name}' no tiene una explicación clínica "
                    f"suficiente (mínimo {MIN_WHY_LENGTH} caracteres)."
                ),
            ))
    return violations


def _check_clinical_compatibility(plan: PlanBase, pathologies: list[str] | None) -> list[GuardrailViolation]:
    violations = []

    # Un usuario puede tener varias condiciones a la vez (ej. diabetes Y
    # enfermedad renal); se valida contra el tope más estricto de cada una.
    for rule in resolve_clinical_rules(pathologies):
        if rule.max_daily_carbs_g is not None and plan.macros.carbs > rule.max_daily_carbs_g:
            violations.append(GuardrailViolation(
                code="carbs_exceed_condition_limit",
                severity=Severity.BLOCKING,
                message=(
                    f"El plan tiene {plan.macros.carbs:.0f}g de carbohidratos, por encima "
                    f"del límite de {rule.max_daily_carbs_g:.0f}g recomendado para '{rule.name}'."
                ),
            ))

        if rule.max_daily_protein_g is not None and plan.macros.protein > rule.max_daily_protein_g:
            violations.append(GuardrailViolation(
                code="protein_exceeds_condition_limit",
                severity=Severity.BLOCKING,
                message=(
                    f"El plan tiene {plan.macros.protein:.0f}g de proteína, por encima "
                    f"del límite de {rule.max_daily_protein_g:.0f}g recomendado para '{rule.name}'."
                ),
            ))

    return violations


def run_guardrails(plan: PlanBase, pathologies: list[str] | None) -> GuardrailReport:
    violations: list[GuardrailViolation] = [
        *_check_calorie_bounds(plan),
        *_check_macro_consistency(plan),
        *_check_explainability(plan),
        *_check_clinical_compatibility(plan, pathologies),
    ]
    passed = not any(v.severity == Severity.BLOCKING for v in violations)
    return GuardrailReport(passed=passed, violations=violations)


def _check_aggressive_progress_with_condition(user: UserBase) -> list[GuardrailViolation]:
    if user.goal_profile.progress_speed != "agresivo":
        return []

    rules = resolve_clinical_rules(user.clinical_profile.pathologies)
    if any(rule is not DEFAULT_RULE for rule in rules):
        return [GuardrailViolation(
            code="aggressive_progress_blocked_by_condition",
            severity=Severity.BLOCKING,
            message=(
                "No se permite una velocidad de progreso 'agresiva' cuando el usuario "
                "declara una condición clínica. Usa 'lento' o 'moderado'."
            ),
        )]
    return []


def run_profile_guardrails(user: UserBase) -> GuardrailReport:
    """Guardrails sobre el PERFIL del usuario (no sobre un plan).

    Por ahora solo cubre el caso explícito del backlog: bloquear una meta de
    progreso agresiva cuando hay una condición clínica declarada. Se separa de
    `run_guardrails` porque valida otro objeto (perfil vs. plan nutricional).
    """
    violations = _check_aggressive_progress_with_condition(user)
    passed = not any(v.severity == Severity.BLOCKING for v in violations)
    return GuardrailReport(passed=passed, violations=violations)

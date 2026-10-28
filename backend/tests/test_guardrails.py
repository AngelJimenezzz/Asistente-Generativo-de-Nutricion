import pytest
from pydantic import ValidationError

from app.guardrails.engine import run_guardrails, run_profile_guardrails
from app.models.plan import PlanCreate
from app.models.user import UserCreate

VALID_MEAL = {
    "id": "1",
    "name": "Desayuno",
    "items": ["Avena con moras y nueces"],
    "why": "La avena aporta betaglucanos que ayudan a estabilizar la glucosa.",
}


def make_plan(**overrides) -> PlanCreate:
    payload = {
        "userId": "507f1f77bcf86cd799439011",
        "calories": 1850,
        "macros": {"protein": 110, "carbs": 190, "fat": 60},
        "meals": [VALID_MEAL],
    }
    payload.update(overrides)
    return PlanCreate(**payload)


def test_valid_plan_passes_with_no_condition():
    plan = make_plan()
    report = run_guardrails(plan, pathologies=None)
    assert report.passed
    assert report.violations == []


def test_valid_plan_passes_for_diabetes_within_carb_limit():
    plan = make_plan()  # 190g carbs, límite diabetes es 220g
    report = run_guardrails(plan, pathologies=["diabetes_tipo_2"])
    assert report.passed


def test_calories_below_safe_minimum_is_blocked():
    plan = make_plan(calories=900, macros={"protein": 50, "carbs": 90, "fat": 30})
    report = run_guardrails(plan, pathologies=None)
    assert not report.passed
    assert any(v.code == "calories_too_low" for v in report.violations)


def test_calories_above_safe_maximum_is_blocked():
    plan = make_plan(calories=4000, macros={"protein": 200, "carbs": 400, "fat": 150})
    report = run_guardrails(plan, pathologies=None)
    assert not report.passed
    assert any(v.code == "calories_too_high" for v in report.violations)


def test_macro_calorie_mismatch_is_blocked():
    # Macros implican ~740 kcal pero el plan declara 1850 — muy por fuera del 10% de tolerancia.
    plan = make_plan(calories=1850, macros={"protein": 10, "carbs": 100, "fat": 10})
    report = run_guardrails(plan, pathologies=None)
    assert not report.passed
    assert any(v.code == "macro_calorie_mismatch" for v in report.violations)


def test_missing_explanation_is_blocked():
    meal = {**VALID_MEAL, "why": "muy corto"}
    plan = make_plan(meals=[meal])
    report = run_guardrails(plan, pathologies=None)
    assert not report.passed
    assert any(v.code == "missing_explanation" for v in report.violations)


def test_carbs_exceed_diabetes_limit_is_blocked():
    plan = make_plan(calories=2000, macros={"protein": 100, "carbs": 250, "fat": 40})
    report = run_guardrails(plan, pathologies=["diabetes_tipo_2"])
    assert not report.passed
    assert any(v.code == "carbs_exceed_condition_limit" for v in report.violations)


def test_protein_exceeds_renal_limit_is_blocked():
    plan = make_plan(calories=2000, macros={"protein": 150, "carbs": 150, "fat": 45})
    report = run_guardrails(plan, pathologies=["enfermedad_renal"])
    assert not report.passed
    assert any(v.code == "protein_exceeds_condition_limit" for v in report.violations)


def test_both_conditions_at_once_check_both_limits():
    # 250g carbs (excede diabetes) Y 150g proteína (excede renal) a la vez.
    plan = make_plan(calories=2200, macros={"protein": 150, "carbs": 250, "fat": 40})
    report = run_guardrails(plan, pathologies=["diabetes_tipo_2", "enfermedad_renal"])
    codes = {v.code for v in report.violations}
    assert "carbs_exceed_condition_limit" in codes
    assert "protein_exceeds_condition_limit" in codes


def test_empty_meals_list_rejected_at_schema_level():
    with pytest.raises(ValidationError):
        make_plan(meals=[])


def test_negative_macros_rejected_at_schema_level():
    with pytest.raises(ValidationError):
        make_plan(macros={"protein": -5, "carbs": 100, "fat": 20})


# ── Guardrails de perfil (no de plan) ────────────────────────────────────────

def make_user(**overrides) -> UserCreate:
    payload = {"name": "Ana"}
    payload.update(overrides)
    return UserCreate(**payload)


def test_profile_without_condition_allows_aggressive_speed():
    user = make_user(goalProfile={"progressSpeed": "agresivo"})
    report = run_profile_guardrails(user)
    assert report.passed


def test_profile_with_condition_blocks_aggressive_speed():
    user = make_user(
        goalProfile={"progressSpeed": "agresivo"},
        clinicalProfile={"pathologies": ["diabetes_tipo_2"]},
    )
    report = run_profile_guardrails(user)
    assert not report.passed
    assert any(v.code == "aggressive_progress_blocked_by_condition" for v in report.violations)


def test_profile_with_condition_allows_moderate_speed():
    user = make_user(
        goalProfile={"progressSpeed": "moderado"},
        clinicalProfile={"pathologies": ["diabetes_tipo_2"]},
    )
    report = run_profile_guardrails(user)
    assert report.passed

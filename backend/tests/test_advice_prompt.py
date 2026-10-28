from app.models.user import UserBase
from app.rag.prompt import BUDGET_INTRO, SOCIAL_EVENT_INTRO, build_advice_system_prompt


def make_user(**overrides) -> UserBase:
    payload = {"name": "Ana"}
    payload.update(overrides)
    return UserBase(**payload)


def test_social_event_prompt_incluye_intro_y_reglas():
    user = make_user(dietaryProfile={"allergies": ["mariscos"]})
    prompt = build_advice_system_prompt(SOCIAL_EVENT_INTRO, user, [], latest_plan=None)
    assert "salida social" in prompt
    assert "mariscos" in prompt
    assert "no eres un profesional de la salud" in prompt.lower()


def test_budget_prompt_incluye_intro_y_perfil():
    user = make_user(lifestyleProfile={"budgetTier": "economico"})
    prompt = build_advice_system_prompt(BUDGET_INTRO, user, [], latest_plan=None)
    assert "sustituciones" in prompt.lower()
    assert "economico" in prompt


def test_ambos_prompts_incluyen_el_plan_actual_si_existe():
    user = make_user()
    plan = {"calories": 1800, "meals": [{"name": "Comida", "items": ["Pollo"], "why": "Proteína magra."}]}
    prompt = build_advice_system_prompt(SOCIAL_EVENT_INTRO, user, [], latest_plan=plan)
    assert "1800 kcal" in prompt
    assert "Pollo" in prompt

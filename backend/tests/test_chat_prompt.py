from app.models.user import UserBase
from app.rag.prompt import build_chat_system_prompt


def make_user(**overrides) -> UserBase:
    payload = {"name": "Ana"}
    payload.update(overrides)
    return UserBase(**payload)


def test_prompt_sin_plan_lo_indica_explicitamente():
    user = make_user()
    prompt = build_chat_system_prompt(user, [], latest_plan=None)
    assert "todavía no tiene un plan generado" in prompt


def test_prompt_con_plan_incluye_las_comidas():
    user = make_user()
    plan = {
        "calories": 1800,
        "meals": [{"name": "Desayuno", "items": ["Avena"], "why": "Fibra soluble."}],
    }
    prompt = build_chat_system_prompt(user, [], latest_plan=plan)
    assert "1800 kcal" in prompt
    assert "Avena" in prompt
    assert "Fibra soluble." in prompt


def test_prompt_incluye_reglas_de_alergias_y_disclaimer():
    user = make_user(dietaryProfile={"allergies": ["mariscos"]})
    prompt = build_chat_system_prompt(user, [], latest_plan=None)
    assert "mariscos" in prompt
    assert "no sustituyes una consulta médica" in prompt

"""
Construcción del prompt para el modelo generativo (la "G" de RAG).

El prompt combina: (1) los fragmentos de la base de conocimiento clínico
recuperados para las condiciones del usuario, y (2) el perfil del usuario
capturado en el registro. Se le pide al modelo el plan de UN SOLO DÍA (hoy) en
un JSON con la forma EXACTA que espera `app.models.plan.PlanCreate` (sin
`userId`/`weekId`/`dayIndex`, que los agrega el backend), para que pase
directo por los guardrails existentes sin transformación manual.

Decisión de producto (no solo técnica): se genera un día a la vez a propósito,
no la semana completa — la idea es que la app se use todos los días, no que se
pueda generar toda la semana de un jalón y no volver a entrar. Ver
`app/api/routes/plans.py::generate_plan` para cómo se agrupan los días de una
misma semana calendario conforme se van generando.
"""

from __future__ import annotations

from app.guardrails.engine import CALORIE_TOLERANCE, MAX_SAFE_CALORIES, MIN_SAFE_CALORIES
from app.guardrails.rules import DEFAULT_RULE, resolve_clinical_rules
from app.models.user import UserBase

SYSTEM_PROMPT = """Eres un asistente de nutrición de precisión. Generas el plan de \
alimentación de HOY (un solo día) basado ESTRICTAMENTE en la evidencia clínica que \
se te proporciona a continuación — no uses conocimiento nutricional propio que \
contradiga estas fichas.

Reglas no negociables:
1. NUNCA incluyas un alimento que esté en la lista de alergias del usuario, bajo \
ninguna circunstancia, ni como ingrediente secundario.
2. NUNCA incluyas un alimento de la lista de "no le gusta" del usuario.
3. Cada comida necesita un campo "why" que explique la razón clínica/nutricional \
de esa elección, citando la lógica de las fichas clínicas dadas — no puede estar \
vacío ni ser genérico ("es saludable" no es válido).
4. Los platillos deben ser realistas y accesibles en el país del usuario (ver su \
perfil abajo). Por defecto, si no declaró país o declaró México, usa ingredientes \
comunes en la dieta mexicana (frijol, nopal, tortilla de maíz, huevo, etc.) en vez \
de equivalentes importados. Si declaró otro país, adapta a la gastronomía típica \
de ese país en su lugar.
5. Respeta la filosofía alimentaria del usuario. IMPORTANTE si declaró \
"ayuno_intermitente": NO incluyas desayuno — la primera comida del día debe caer \
dentro de una ventana de alimentación típica (ej. la comida de mediodía), y el \
número de comidas normalmente es 2, no 3. Poner un desayuno cuando el usuario \
ayuna es un error grave, no lo cometas.
6. El número de comidas debe coincidir con lo que pidió el usuario (salvo el \
ajuste de la regla 5 para ayuno intermitente, que tiene prioridad).
7. Los macros (proteína×4 + carbohidratos×4 + grasa×9) deben sumar, en calorías, \
algo muy cercano a las calorías totales declaradas (±10%).
8. Cada alimento en "items" debe incluir una PORCIÓN APROXIMADA y, cuando aplique, \
el modo de preparación — ej. "150g de pechuga de pollo a la plancha" en vez de \
solo "pechuga de pollo", "1 taza de arroz integral cocido" en vez de solo "arroz". \
Usa medidas que alguien pueda llevar al súper o a la cocina (gramos, tazas, piezas), \
no solo nombres genéricos del alimento.

Responde ÚNICAMENTE con un JSON con esta forma exacta, sin texto antes ni después, \
sin bloque de código markdown:
{
  "calories": <número>,
  "macros": {"protein": <número>, "carbs": <número>, "fat": <número>},
  "meals": [
    {"id": "1", "name": "<nombre de la comida>", "items": ["<alimento 1>", "..."], "why": "<explicación clínica>"}
  ]
}"""


def _format_knowledge(documents: list[dict]) -> str:
    if not documents:
        return "(No hay fichas clínicas específicas; usa solo criterios generales de nutrición saludable.)"
    lines = []
    for doc in documents:
        lines.append(f"- [{doc['tema']}] {doc['contenido']} (Fuente: {doc['fuente_id']})")
    return "\n".join(lines)


def _format_user_profile(user: UserBase) -> str:
    parts = [f"Nombre: {user.name}"]

    anthro = user.anthropometrics
    if anthro.age or anthro.weight_kg or anthro.height_cm:
        parts.append(
            f"Datos: edad {anthro.age or '?'}, sexo {anthro.biological_sex or '?'}, "
            f"estatura {anthro.height_cm or '?'}cm, peso {anthro.weight_kg or '?'}kg"
        )

    if user.goal_profile.primary_goal:
        parts.append(f"Objetivo: {user.goal_profile.primary_goal} (velocidad: {user.goal_profile.progress_speed or 'no especificada'})")

    if user.clinical_profile.pathologies:
        parts.append(f"Condiciones clínicas: {', '.join(user.clinical_profile.pathologies)}")
    if user.clinical_profile.digestive_conditions:
        parts.append(f"Trastornos digestivos: {', '.join(user.clinical_profile.digestive_conditions)}")

    if user.dietary_profile.allergies:
        parts.append(f"ALERGIAS (excluir totalmente): {', '.join(user.dietary_profile.allergies)}")
    if user.dietary_profile.diet_philosophy:
        parts.append(f"Filosofía alimentaria: {user.dietary_profile.diet_philosophy}")
    if user.dietary_profile.disliked_foods:
        disliked = ", ".join(f.name for f in user.dietary_profile.disliked_foods)
        parts.append(f"No le gusta (evitar): {disliked}")

    lifestyle = user.lifestyle_profile
    if lifestyle.budget_tier:
        parts.append(f"Presupuesto: {lifestyle.budget_tier}")
    if lifestyle.kitchen_equipment:
        parts.append(f"Equipo de cocina disponible: {', '.join(lifestyle.kitchen_equipment)}")
    if lifestyle.cooking_time:
        parts.append(f"Tiempo para cocinar: {lifestyle.cooking_time}")
    if lifestyle.meals_per_day:
        parts.append(f"Número de comidas al día requerido: {lifestyle.meals_per_day}")
    if lifestyle.region:
        parts.append(
            f"País del usuario: {lifestyle.region}. Adapta los platillos, ingredientes y "
            f"nombres a lo típico/accesible en ese país (si es México, prioriza ingredientes "
            f"mexicanos como ya se indica arriba; si es otro país, usa su gastronomía local)."
        )

    return "\n".join(parts)


def _format_hard_limits(pathologies: list[str] | None) -> str:
    """Límites NUMÉRICOS exactos que el plan generado debe respetar — son los
    mismos que usa `app.guardrails.engine` para validar la respuesta después.
    Dárselos al modelo por adelantado reduce cuántos planes se rechazan por no
    cumplirlos, aunque los guardrails siguen siendo la verificación real."""
    lines = [
        f"- Calorías totales entre {MIN_SAFE_CALORIES} y {MAX_SAFE_CALORIES} kcal/día.",
        f"- (proteína×4 + carbohidratos×4 + grasa×9) debe estar a máximo {CALORIE_TOLERANCE:.0%} "
        f"de las calorías totales que declares.",
    ]
    for rule in resolve_clinical_rules(pathologies):
        if rule is DEFAULT_RULE:
            continue
        if rule.max_daily_carbs_g is not None:
            lines.append(f"- Por '{rule.name}': máximo {rule.max_daily_carbs_g:.0f}g de carbohidratos al día.")
        if rule.max_daily_protein_g is not None:
            lines.append(f"- Por '{rule.name}': máximo {rule.max_daily_protein_g:.0f}g de proteína al día.")
    return "\n".join(lines)


def build_user_prompt(user: UserBase, knowledge_documents: list[dict]) -> str:
    return (
        f"### Fichas clínicas relevantes\n{_format_knowledge(knowledge_documents)}\n\n"
        f"### Límites numéricos obligatorios (el plan se rechaza si no los cumple)\n"
        f"{_format_hard_limits(user.clinical_profile.pathologies)}\n\n"
        f"### Perfil del usuario\n{_format_user_profile(user)}\n\n"
        f"Genera el plan de alimentación de HOY para este usuario."
    )


CHAT_SYSTEM_PROMPT_HEADER = """Eres el asistente conversacional del Asistente Generativo \
de Nutrición de Precisión. Respondes preguntas del usuario sobre nutrición, su plan \
actual, y hábitos alimenticios saludables.

Reglas no negociables:
1. Nunca sugieras un alimento que esté en la lista de alergias del usuario.
2. Nunca sugieras un alimento de su lista de "no le gusta".
3. NO eres un profesional de la salud y no sustituyes una consulta médica o con un \
nutriólogo. Si el usuario pregunta algo que requiere un diagnóstico médico, una \
receta médica, o un ajuste clínico importante (ej. cambiar dosis de medicamento), \
dile explícitamente que consulte a su médico o nutriólogo — no lo intentes resolver tú.
4. Basa tus respuestas nutricionales en las fichas clínicas que se te dan a \
continuación, no en conocimiento genérico que las contradiga.
5. Sé breve y conversacional (2-4 oraciones), como un chat — no escribas ensayos.
6. Si el usuario tiene un plan activo (se muestra abajo), puedes explicar por qué \
se eligió algo en él, pero no te desvíes de lo que ya se le explicó ahí."""


def _format_latest_plan(plan: dict | None) -> str:
    if not plan:
        return "(El usuario todavía no tiene un plan generado.)"
    lines = [f"Calorías: {plan['calories']} kcal"]
    for meal in plan.get("meals", []):
        lines.append(f"- {meal['name']}: {', '.join(meal['items'])} — {meal['why']}")
    return "\n".join(lines)


def build_chat_system_prompt(user: UserBase, knowledge_documents: list[dict], latest_plan: dict | None) -> str:
    return (
        f"{CHAT_SYSTEM_PROMPT_HEADER}\n\n"
        f"### Fichas clínicas relevantes\n{_format_knowledge(knowledge_documents)}\n\n"
        f"### Perfil del usuario\n{_format_user_profile(user)}\n\n"
        f"### Plan actual del usuario\n{_format_latest_plan(latest_plan)}"
    )


# ── "Tengo una salida con amigos" (antes "Simular un evento social / Plan B") ──

SOCIAL_EVENT_INTRO = """Eres el asistente de nutrición de precisión. El usuario te \
va a contar sobre una salida social (restaurante, fiesta, reunión, comida familiar) \
donde va a comer fuera de su rutina habitual. Tu trabajo:

1. Dale 2-4 sugerencias CONCRETAS de qué pedir o evitar en ese tipo de lugar o \
situación — nunca sugieras algo de su lista de alergias, y respeta su condición \
clínica y su filosofía alimentaria.
2. Sugiere cómo ajustar el RESTO de su día (las comidas antes o después de esa \
salida, usando su plan actual si lo tiene) para mantener el equilibrio sin que \
tenga que cancelar sus planes de salir.
3. Tono comprensivo y práctico, nunca de regaño — el objetivo es que disfrute la \
salida sin culpa y sin perder de vista su condición de salud.
4. Sé breve (4-6 oraciones), como un consejo rápido y accionable, no un ensayo.
5. NO eres un profesional de la salud. Si algo suena a una decisión médica seria, \
dile que consulte a su médico o nutriólogo."""


# ── "Ajustar por presupuesto/disponibilidad" ────────────────────────────────

BUDGET_INTRO = """Eres el asistente de nutrición de precisión. El usuario te va a \
contar sobre una limitación de presupuesto o sobre qué alimentos tiene disponibles \
esta semana (ej. "solo tengo huevo, frijol y arroz" o "quiero gastar menos"). Tu \
trabajo:

1. Sugiere sustituciones de alimentos DENTRO DEL MISMO GRUPO nutricional (una \
proteína por otra proteína, un carbohidrato por otro carbohidrato, etc.) para que \
el plan siga aportando aproximadamente los mismos macros — usa lo que el usuario \
ya tiene disponible, o alternativas económicas y accesibles en su país (huevo, \
frijol, atún enlatado, avena, lentejas, etc. si es México; adapta si declaró otro \
país).
2. Respeta SIEMPRE sus alergias y lo que no le gusta — nunca sugieras esos alimentos.
3. Si tiene un plan actual, sugiere sustituciones concretas dentro de ESE plan \
("cambia X por Y porque...").
4. Sé breve y práctico (4-6 oraciones), no un ensayo.
5. NO eres un profesional de la salud."""


def build_advice_system_prompt(
    intro: str, user: UserBase, knowledge_documents: list[dict], latest_plan: dict | None
) -> str:
    """Prompt compartido para respuestas puntuales de una sola pregunta
    (no conversación multi-turno como el chat), usado por "Tengo una salida
    con amigos" y "Ajustar por presupuesto/disponibilidad"."""
    return (
        f"{intro}\n\n"
        f"### Fichas clínicas relevantes\n{_format_knowledge(knowledge_documents)}\n\n"
        f"### Perfil del usuario\n{_format_user_profile(user)}\n\n"
        f"### Plan actual del usuario\n{_format_latest_plan(latest_plan)}"
    )


# ── Cambiar UNA sola comida sin regenerar el día completo ────────────────────
#
# Pedido explícito: si al usuario no le gusta una sola comida, no debería
# tener que regenerar el día entero (y arriesgarse a perder las que sí le
# gustaron) ni gastar tokens de más. Reutiliza la misma recuperación de
# fichas clínicas y el mismo modelo, pero le pide solo el reemplazo de esa
# comida puntual.

MEAL_SWAP_SYSTEM_PROMPT = """Eres un asistente de nutrición de precisión. El usuario \
quiere cambiar SOLO una comida de su plan de hoy (no el día completo) porque no le \
gustó o quiere variar. Genera UNA alternativa para esa misma comida, basada \
ESTRICTAMENTE en la evidencia clínica que se te proporciona.

Reglas no negociables:
1. NUNCA incluyas un alimento que esté en la lista de alergias del usuario.
2. NUNCA incluyas un alimento de la lista de "no le gusta" del usuario.
3. La alternativa debe ser CLARAMENTE DIFERENTE a los alimentos actuales de esa \
comida — repetir lo mismo (o algo casi idéntico) no cumple con el pedido de cambio.
4. Respeta la filosofía alimentaria del usuario (ej. si es "ayuno_intermitente" y \
la comida a reemplazar no es un desayuno, no conviertas esta comida en un desayuno).
5. Debe ser realista y accesible en el país del usuario (México por defecto).
6. Necesita un campo "why" con explicación clínica/nutricional real, no vacío ni \
genérico ("es saludable" no es válido).
7. Cada alimento en "items" debe incluir una PORCIÓN APROXIMADA y, cuando aplique, \
el modo de preparación — ej. "150g de pechuga de pollo a la plancha" en vez de \
solo "pechuga de pollo".

Responde ÚNICAMENTE con un JSON con esta forma exacta, sin texto antes ni después, \
sin bloque de código markdown:
{"name": "<mismo tipo de comida, ej. Desayuno>", "items": ["<alimento 1>", "..."], "why": "<explicación clínica>"}"""


def build_meal_swap_prompt(
    user: UserBase, knowledge_documents: list[dict], meal_name: str, current_items: list[str]
) -> str:
    return (
        f"### Fichas clínicas relevantes\n{_format_knowledge(knowledge_documents)}\n\n"
        f"### Perfil del usuario\n{_format_user_profile(user)}\n\n"
        f"### Comida a reemplazar\nTipo: {meal_name}\n"
        f"Alimentos actuales (el usuario ya no los quiere): {', '.join(current_items)}\n\n"
        f"Genera una alternativa distinta para esta comida."
    )

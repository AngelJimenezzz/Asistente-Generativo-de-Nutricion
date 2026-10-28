"""
Genera el dataset de fine-tuning (Actividad 2 de la tesis: entrenamiento del
modelo) usando el MISMO pipeline de RAG que ya corre en producción en
`POST /api/plans/generate` — no es un dataset inventado a mano, es
"destilación": se usa el modelo grande ya probado (Llama 3.3 70B vía
Together.ai) para generar ejemplos de alta calidad sobre perfiles de usuario
sintéticos pero realistas, cada uno filtrado por los MISMOS guardrails
deterministas que protegen un plan real (`app/guardrails/engine.py`). Solo
los que SÍ pasan guardrails entran al dataset — así el modelo chico (Llama
3.1 8B) se afina sobre ejemplos ya validados clínicamente, no sobre lo que
sea que haya respondido el modelo grande.

El resultado (`data/training/plans_train.jsonl` y `plans_val.jsonl`) es el
insumo del notebook de Colab `notebooks/finetune_llama31_8b_qlora.ipynb`, que
hace el entrenamiento QLoRA real (necesita GPU, por eso es notebook y no un
script de este backend).

Formato de cada línea (JSONL, un ejemplo de chat por línea — mismo formato
que espera `tokenizer.apply_chat_template` de Llama 3.1):
    {"messages": [
        {"role": "system", "content": "<SYSTEM_PROMPT>"},
        {"role": "user", "content": "<perfil + fichas clínicas + límites>"},
        {"role": "assistant", "content": "<plan JSON, el que pasó guardrails>"}
    ]}

Uso (desde backend/, con TOGETHER_API_KEY configurada en .env):

    python scripts/generate_finetune_dataset.py --count 10
    python scripts/generate_finetune_dataset.py --count 150 --price-per-million-tokens 0.88

CONTROL DE GASTO — Together.ai es prepago (nunca más de 500 MXN/mes, ~$5 USD
cargados, sin auto-recarga). Este script va imprimiendo el
gasto ESTIMADO conforme genera y se DETIENE solo si pasa `--max-cost-usd`
(default $3.00, deja margen del resto del presupuesto para seguir usando la
app). El precio por millón de tokens es un ESTIMADO configurable
(`--price-per-million-tokens`) — confirma el precio real vigente en
together.ai/pricing para el modelo Llama-3.3-70B-Instruct-Turbo antes de
correr un --count grande; este script no lo consulta automáticamente.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# La consola de Windows (cp1252) truena con acentos/flechas si no se fuerza
# UTF-8 — este script es casi puro texto en español para la terminal.
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

from app.guardrails.engine import run_guardrails  # noqa: E402
from app.models.plan import PlanCreate  # noqa: E402
from app.models.user import UserBase  # noqa: E402
from app.rag.knowledge_base import retrieve_relevant_documents  # noqa: E402
from app.rag.prompt import SYSTEM_PROMPT, build_user_prompt  # noqa: E402
from app.services.llm import LLMError, generate_json_with_usage  # noqa: E402

TRAINING_DIR = Path(__file__).resolve().parents[2] / "data" / "training"
TRAIN_PATH = TRAINING_DIR / "plans_train.jsonl"
VAL_PATH = TRAINING_DIR / "plans_val.jsonl"
REJECTED_PATH = TRAINING_DIR / "rejected_examples.jsonl"

VAL_FRACTION = 0.1  # ~10% de los ejemplos que SÍ pasan van a validación

# ── Dimensiones para armar perfiles sintéticos pero realistas ───────────────
# Mismos slugs/valores exactos que acepta el formulario real de registro
# (ver src/data/onboardingOptions.js y backend/app/models/user.py) — así el
# dataset de entrenamiento refleja perfiles que un usuario real SÍ podría
# tener, no combinaciones inventadas fuera de lo que la app permite.

PATHOLOGY_CHOICES: list[list[str]] = [
    [],
    [],  # se repite "sin condición" para que no sea minoría en el dataset
    ["diabetes_tipo_2"],
    ["hipertension"],
    ["enfermedad_renal"],
    ["resistencia_insulina"],
    ["sop"],
    ["hipotiroidismo"],
    ["higado_graso"],
    ["diabetes_tipo_2", "hipertension"],
]
DIET_PHILOSOPHY_CHOICES = [None, "omnivoro", "vegetariano", "vegano", "pescetariano", "keto", "ayuno_intermitente"]
ALLERGY_CHOICES: list[list[str]] = [[], [], ["lacteos"], ["gluten"], ["mariscos"], ["cacahuates", "nueces"]]
COUNTRY_CHOICES = ["México", "México", "México", "México", "Argentina", "España", "Colombia", "Estados Unidos"]
MEALS_PER_DAY_CHOICES = [2, 3, 3, 4, 5]
BUDGET_CHOICES = ["economico", "estandar", "premium"]
COOKING_TIME_CHOICES = ["menos_15_min", "30_min", "tengo_tiempo"]
PRIMARY_GOAL_CHOICES = [
    "perdida_grasa", "ganancia_muscular", "recomposicion",
    "mantenimiento", "rendimiento_deportivo", "control_salud",
]
NAME_POOL = ["Ana", "Luis", "Marisol", "Carlos", "Fernanda", "Jorge", "Paola", "Ricardo", "Daniela", "Miguel"]
# La semilla real se fija en main() a partir de --seed; este default solo
# aplica si el módulo se importa sin pasar por main() (ej. en una prueba).
random.seed(42)


def _random_profile() -> UserBase:
    pathologies = random.choice(PATHOLOGY_CHOICES)
    diet_philosophy = random.choice(DIET_PHILOSOPHY_CHOICES)
    meals_per_day = random.choice(MEALS_PER_DAY_CHOICES)
    if diet_philosophy == "ayuno_intermitente":
        # Con ayuno intermitente casi siempre son 2-3 comidas, no 5 — igual que
        # pediría un usuario real que declara esa filosofía.
        meals_per_day = random.choice([2, 3])

    # Mismo criterio que el guardrail de perfil real (run_profile_guardrails):
    # no combinar "agresivo" con una condición clínica.
    progress_speed = (
        random.choice(["lento", "moderado"])
        if pathologies
        else random.choice(["lento", "moderado", "agresivo"])
    )

    return UserBase(
        name=random.choice(NAME_POOL),
        anthropometrics={
            "age": random.randint(19, 65),
            "biological_sex": random.choice(["femenino", "masculino"]),
            "height_cm": random.randint(150, 190),
            "weight_kg": random.randint(50, 110),
        },
        activity_level={
            "work_activity": random.choice(["sedentario", "de_pie", "trabajo_fisico"]),
            "exercise_days_per_week": random.randint(0, 6),
        },
        goal_profile={
            "primary_goal": random.choice(PRIMARY_GOAL_CHOICES),
            "progress_speed": progress_speed,
        },
        clinical_profile={"pathologies": pathologies},
        dietary_profile={"allergies": random.choice(ALLERGY_CHOICES), "diet_philosophy": diet_philosophy},
        lifestyle_profile={
            "budget_tier": random.choice(BUDGET_CHOICES),
            "cooking_time": random.choice(COOKING_TIME_CHOICES),
            "meals_per_day": meals_per_day,
            "region": random.choice(COUNTRY_CHOICES),
        },
    )


def _estimate_cost_usd(total_tokens: int, price_per_million: float) -> float:
    return (total_tokens / 1_000_000) * price_per_million


async def generate_dataset(count: int, max_cost_usd: float, price_per_million: float) -> None:
    TRAINING_DIR.mkdir(parents=True, exist_ok=True)

    accepted = 0
    rejected = 0
    errors = 0
    total_tokens = 0

    for i in range(count):
        estimated_cost_so_far = _estimate_cost_usd(total_tokens, price_per_million)
        if estimated_cost_so_far >= max_cost_usd:
            print(
                f"\n⚠️  Gasto estimado (${estimated_cost_so_far:.3f}) alcanzó el límite "
                f"--max-cost-usd (${max_cost_usd:.2f}). Deteniendo antes de generar más "
                f"ejemplos para no exceder el presupuesto."
            )
            break

        user = _random_profile()
        knowledge_documents = retrieve_relevant_documents(user.clinical_profile.pathologies)
        user_prompt = build_user_prompt(user, knowledge_documents)

        try:
            raw_plan, usage = await generate_json_with_usage(SYSTEM_PROMPT, user_prompt)
        except LLMError as exc:
            errors += 1
            print(f"[{i + 1}/{count}] ERROR del modelo: {exc}")
            continue

        total_tokens += usage.get("total_tokens", 0)

        raw_plan["userId"] = "synthetic"
        macros = raw_plan.get("macros") or {}
        if all(k in macros for k in ("protein", "carbs", "fat")):
            raw_plan["calories"] = macros["protein"] * 4 + macros["carbs"] * 4 + macros["fat"] * 9

        try:
            plan = PlanCreate(**raw_plan)
        except Exception as exc:  # noqa: BLE001 — cualquier forma inesperada del modelo se descarta igual
            rejected += 1
            _append_jsonl(REJECTED_PATH, {"reason": f"forma inválida: {exc}", "raw": raw_plan})
            print(f"[{i + 1}/{count}] rechazado (forma inválida)")
            continue

        report = run_guardrails(plan, pathologies=user.clinical_profile.pathologies)
        if not report.passed:
            rejected += 1
            _append_jsonl(
                REJECTED_PATH,
                {
                    "reason": "no pasó guardrails",
                    "violations": [v.message for v in report.violations],
                    "profile": user.model_dump(),
                    "raw": raw_plan,
                },
            )
            print(f"[{i + 1}/{count}] rechazado por guardrails: {[v.code for v in report.violations]}")
            continue

        accepted += 1
        assistant_content = json.dumps(
            {k: v for k, v in plan.model_dump(by_alias=False).items() if k not in ("user_id", "week_id", "day_index", "day_of_week")},
            ensure_ascii=False,
        )
        example = {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
                {"role": "assistant", "content": assistant_content},
            ]
        }
        # Se guarda EN EL MOMENTO (no al final) — si el script se interrumpe
        # a medias (se cierra la terminal, se va la luz, Ctrl+C), lo ya
        # generado y aceptado queda a salvo en disco, no se pierde.
        destination = VAL_PATH if random.random() < VAL_FRACTION else TRAIN_PATH
        _append_jsonl(destination, example)
        print(
            f"[{i + 1}/{count}] OK — aceptado y guardado en {destination.name} "
            f"(gasto estimado hasta ahora: ${_estimate_cost_usd(total_tokens, price_per_million):.3f})"
        )

    print(
        f"\nListo. Aceptados: {accepted} · Rechazados por guardrails/forma: {rejected} · "
        f"Errores del modelo: {errors}\n"
        f"  → Ejemplos aceptados guardados en {TRAIN_PATH} y {VAL_PATH} conforme se iban generando\n"
        f"  → Rechazados guardados (para revisar, no para entrenar) en {REJECTED_PATH}\n"
        f"  → Gasto estimado total de esta corrida: ${_estimate_cost_usd(total_tokens, price_per_million):.3f} USD "
        f"({total_tokens} tokens a ${price_per_million}/millón)"
    )


def _append_jsonl(path: Path, obj: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(obj, ensure_ascii=False) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--count", type=int, default=10, help="Cuántos perfiles sintéticos intentar (default: 10, una corrida de prueba barata).")
    parser.add_argument("--max-cost-usd", type=float, default=3.0, help="Tope de gasto estimado antes de detenerse (default: $3.00, deja margen del prepago de ~$5).")
    parser.add_argument("--price-per-million-tokens", type=float, default=0.88, help="Precio estimado por millón de tokens — VERIFICA el precio real vigente en together.ai/pricing antes de confiar en el default.")
    parser.add_argument("--seed", type=int, default=42, help="Semilla para reproducibilidad de los perfiles sintéticos.")
    args = parser.parse_args()

    random.seed(args.seed)
    asyncio.run(generate_dataset(args.count, args.max_cost_usd, args.price_per_million_tokens))


if __name__ == "__main__":
    main()

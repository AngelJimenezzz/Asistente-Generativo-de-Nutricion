# Backend — Asistente Generativo de Nutrición de Precisión

FastAPI + Motor (MongoDB async) + Pydantic. Ver `../README.md` para el contexto
completo del proyecto y las decisiones de arquitectura.

## Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

pip install -r requirements.txt
copy .env.example .env       # Windows
# cp .env.example .env       # macOS/Linux
```

Edita `.env` con tu cadena de conexión de MongoDB Atlas.

**Si Atlas no conecta desde tu red** (TLS handshake falla / se queda pensando y
`/health` responde `"mongodb": "unreachable"`), usa MongoDB local mientras lo
resuelves:

```powershell
winget install --id MongoDB.Server
```

Se instala como servicio de Windows y arranca solo. Cambia tu `MONGODB_URI` en
`.env` a `mongodb://localhost:27017` — deja tu cadena de Atlas comentada abajo
para volver a ella después. No necesitas tocar nada más del código; el backend no
sabe ni le importa si Mongo es local o en la nube.

## Ejecutar

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

`--host 0.0.0.0` es necesario para que la app (Expo Go en un dispositivo físico o
emulador) pueda alcanzar la API desde la misma red — con `127.0.0.1` solo
respondería a peticiones desde la propia máquina.

- API: http://127.0.0.1:8000
- Docs interactivas (Swagger): http://127.0.0.1:8000/docs

Si usas un firewall (ej. Firewall de Windows), puede que necesites permitir
conexiones entrantes al puerto 8000 la primera vez que ejecutes esto.

## Endpoints actuales

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Estado de la API y conectividad a MongoDB |
| POST | `/api/users` | Crear usuario (perfil completo del registro; pasa por guardrails de perfil) |
| GET | `/api/users/{user_id}` | Obtener usuario |
| PUT | `/api/users/{user_id}` | Reemplazar el perfil completo (usado por "editar perfil") — ⚠️ ver nota abajo |
| POST | `/api/plans` | Crear un plan (pasa por guardrails clínicos; 422 si no los pasa) |
| POST | `/api/plans/validate` | Correr los guardrails sobre un plan sin guardarlo |
| GET | `/api/plans/{plan_id}` | Obtener un plan |
| GET | `/api/plans/user/{user_id}` | Listar todos los planes (días sueltos) de un usuario |
| GET | `/api/plans/week/{user_id}` | Los 7 días de la semana más reciente generada, ordenados |
| POST | `/api/plans/generate` | Genera **el plan de HOY** con IA (RAG + Llama 3.3 70B) — solo un día por llamada, a propósito (ver sección "Motor RAG") |
| POST | `/api/plans/{plan_id}/meals/{meal_id}/swap` | Reemplaza **una sola comida** del día con IA, sin tocar el resto ni gastar una llamada completa (ver sección "Motor RAG") |
| GET | `/api/foods/barcode/{barcode}` | Buscar un alimento real por código de barras (OpenFoodFacts) |
| GET | `/api/foods/search?q=` | Buscar alimentos reales por texto (ej. "avena") |
| GET | `/api/foods/category/{category}` | Buscar alimentos reales por categoría — pensado para el motor de IA |
| POST | `/api/chat` | Chat del asistente — misma RAG + modelo, en texto libre, con el perfil y el plan actual del usuario como contexto |
| POST | `/api/advice/social-event` | "Tengo una salida con amigos" — consejo para comer fuera + cómo compensar el resto del día |
| POST | `/api/advice/budget` | "Ajustar por presupuesto/disponibilidad" — sustituciones de alimentos por grupo nutricional |

## Base de alimentos real (`app/services/openfoodfacts.py`)

Conexión con la API de [OpenFoodFacts](https://openfoodfacts.org) — la fuente de
verdad de alimentos reales, para que el modelo de IA nunca tenga que inventar
un producto o un valor nutricional.

- **Caché en MongoDB (colección `food_cache`)**, 7 días de vigencia: OpenFoodFacts
  limita a ~10 consultas de búsqueda por minuto por IP, así que sin caché la app se
  bloquearía rápido. Los valores nutricionales de un producto cambian muy poco, así
  que cachear una semana es seguro.
- **Normalización tolerante a datos incompletos**: como OpenFoodFacts es una base
  colaborativa, muchos productos no tienen todos los datos. Cada producto se marca
  con `has_minimum_nutrition_data` — si no tiene energía, proteína, carbohidratos y
  grasa, el sistema lo descarta en vez de asumir ceros (eso generaría un plan
  nutricionalmente inseguro).
- **Degradación segura**: si OpenFoodFacts no responde, el endpoint devuelve `503`
  explícito en vez de datos inventados o vacíos.

Pruébalos de forma aislada (no requieren MongoDB ni internet):

```bash
pytest tests/test_openfoodfacts.py -v
```

Hay una prueba adicional que sí consulta la API real de OpenFoodFacts. No corre por
defecto (está excluida en `pytest.ini`) para no gastar el límite de peticiones;
para correrla a propósito:

```bash
pytest -m integration
```

**Atribución:** los datos de OpenFoodFacts se publican bajo Open Database License
(ODbL), que exige dar crédito. Ya está en la app — `src/screens/ProfileScreen.js`
muestra *"Datos de productos proporcionados por Open Food Facts (ODbL)."*

## Motor RAG (`app/rag/`, `app/services/llm.py`) — Fase 3, parte 1

`POST /api/plans/generate?user_id=X` genera **el plan de HOY** con IA (un solo
día por llamada — decisión de producto deliberada, ver recuadro abajo):

1. **Recuperación**: `app/rag/knowledge_base.py` filtra las fichas de
   `data/clinical/knowledge_base.json` que apliquen a las condiciones del
   usuario (siempre incluye las de categoría "general"). No usa embeddings ni
   base vectorial — el corpus son 12 documentos curados a mano y ya vienen
   etiquetados por condición, así que filtrar por etiqueta es más simple y más
   predecible que una búsqueda semántica (justificable si el corpus creciera
   mucho, no con este tamaño).
2. **Prompt** (`app/rag/prompt.py`): combina las fichas recuperadas, el perfil
   completo del usuario (alergias, filosofía alimentaria, presupuesto, país,
   etc.), y los límites numéricos exactos que exigen los guardrails (calorías,
   tope de carbohidratos/proteína según su condición) — decírselos por
   adelantado reduce cuántos planes se rechazan después. También instruye
   explícitamente que si el usuario declaró `ayuno_intermitente`, **no** incluya
   desayuno (bug real que se observó y corrigió: el modelo ponía desayuno igual).
3. **Generación** (`app/services/llm.py`): llama a **Llama 3.3 70B Instruct
   Turbo vía Together.ai** en modo JSON. Requiere `TOGETHER_API_KEY` en `.env`
   (cuenta de pago por uso — ver más abajo el porqué de este modelo específico).
   Reintenta automáticamente (backoff exponencial, hasta 2 veces) si Together
   responde 429/500/502/503/504 — ya pasó en la práctica que la API tiene
   baches momentáneos, y no vale la pena que el usuario vea un error por eso.
4. **Agrupación por semana**: el backend le asigna `weekId` (calculado
   determinísticamente de la semana calendario de hoy, ej. `"2026-W40"`),
   `dayIndex` (día ISO de la semana, 1=lunes...7=domingo) y `dayOfWeek` (nombre
   real, calculado en Python — no se le confía al modelo saber qué día es). Si
   el usuario ya genera hoy antes, se **reemplaza** ese día (no se duplica). Así,
   sin generar la semana de un jalón, la pantalla de Plan puede ir mostrando la
   semana acumulándose conforme el usuario entra día tras día.
5. **Antes de validar**, el backend **recalcula las calorías a partir de los
   macros que dio el modelo** (`protein×4 + carbs×4 + fat×9`). Los LLM son poco
   confiables haciendo aritmética exacta y declaraban unas calorías que no
   cuadraban con sus propios macros, lo que hacía fallar el guardrail de
   consistencia casi siempre. Esto no relaja el guardrail — solo evita
   penalizar al modelo por un error de suma, no de contenido nutricional.
6. **Guardrails**: el día pasa por exactamente el mismo `run_guardrails()` que
   valida los planes creados a mano. Si no pasa, se responde `422` con las
   violaciones y **no se guarda**.

**Por qué un día a la vez y no la semana completa:** se construyó primero la
versión de 7 días de un jalón, pero se decidió limitarlo a uno por llamada —
la meta de producto es que la persona **regrese a la app todos los días**
(cada día trae su propio plan nuevo), no que junte la semana completa de un
jalón y no vuelva a abrir la app. `GET /api/plans/week/{user_id}` sigue
mostrando todos los días que lleva generados esa semana calendario.

### Cambiar una sola comida (`POST /api/plans/{plan_id}/meals/{meal_id}/swap`)

Pedido explícito: si al usuario no le gusta una sola comida del día, no debería
tener que regenerar el día completo (arriesgándose a perder las que sí le
gustaron) ni gastar una llamada completa a la IA. Este endpoint reutiliza la
misma recuperación de fichas clínicas y el mismo modelo, pero le pide
**solo el reemplazo de esa comida puntual** (`build_meal_swap_prompt` en
`app/rag/prompt.py`), con instrucción explícita de que sea claramente distinta
a los alimentos actuales de esa comida (si no, no cumpliría el pedido de
"cambiar"). La comida nueva reemplaza a la anterior por `id` dentro del mismo
documento de plan, y el día completo (ya con la comida nueva) vuelve a pasar
por `run_guardrails()` antes de guardarse — si no pasa (ej. explicación muy
corta), se responde `422` y no se guarda nada.

**Limitación conocida (compartida con la generación del día completo):** las
calorías/macros del día se dejan igual que antes del cambio. El modelo de plan
no tiene nutrición por alimento (eso depende de OpenFoodFacts, no integrado
con los guardrails todavía), así que recalcular macros a partir de una sola
comida cambiada no sería más preciso que dejarlos como estaban.

### Chat del asistente (`POST /api/chat`)

Reutiliza la misma recuperación de fichas clínicas y el mismo modelo, pero en
modo texto libre (`generate_reply()` en vez de `generate_json()`) para permitir
una conversación de varios turnos. El prompt de sistema
(`build_chat_system_prompt()`) incluye además el **plan actual del usuario**
(si tiene uno), para que pueda responder preguntas tipo "¿por qué me pusiste
lentejas?" citando su propio plan, y tiene instrucciones explícitas de remitir
al usuario a su médico/nutriólogo ante preguntas que impliquen un ajuste
clínico (ej. medicamentos) — probado en vivo con ambos casos.

**Limitación conocida:** a diferencia de los planes, las respuestas del chat
**no** pasan por `run_guardrails()` — son texto libre conversacional, no una
estructura de macros/calorías que un guardrail determinista pueda verificar. La
única defensa aquí es el prompt (reglas de alergias, disclaimer médico). Si en
el futuro el chat empieza a sugerir alimentos concretos de forma estructurada,
valdría la pena revisar si necesita su propia capa de validación.

### "Tengo una salida con amigos" y "Ajustar por presupuesto/disponibilidad" (`app/api/routes/advice.py`)

Antes eran botones sin funcionalidad ("Simular un evento social (Plan B)" y
"Ajustar por presupuesto"). Ahora son consejos de una sola pregunta (no
conversación multi-turno como el chat): el usuario describe su situación en
texto libre y recibe una respuesta corta y accionable, generada con la misma
recuperación de fichas clínicas + perfil + plan actual del usuario. Comparten
`build_advice_system_prompt()` en `app/rag/prompt.py`, cada uno con su propia
instrucción de sistema (`SOCIAL_EVENT_INTRO` / `BUDGET_INTRO`). Igual que el
chat, **no pasan por `run_guardrails()`** (texto libre) — la defensa es el
prompt (nunca alergias, siempre remitir a un profesional si la situación suena
médica).

**Sobre el modelo (importante, no confundir con el fine-tuning de la
Actividad 2):** se usa Llama 3.3 70B porque, al día de hoy, es el único modelo
de la familia Llama que Together ofrece en modo *serverless* (pago por token,
sin rentar servidor). El modelo que se afinará con QLoRA más adelante es
**Llama 3.1 8B**, descargado directo de Hugging Face y entrenado en Google
Colab (el 70B no cabe en la GPU gratuita de Colab). Antes de la comparación
final de la tesis, hay que correr esta misma prueba también con el 8B sin
afinar, para tener un punto de comparación limpio (mismo modelo, antes/después
del fine-tuning) — ver `app/services/llm.py`.

Pruébalo de forma aislada (no requiere red ni MongoDB, solo prueba qué fichas
se recuperan por condición):

```bash
pytest tests/test_rag.py -v
```

## Guardrails clínicos (`app/guardrails/`)

Capa de seguridad no negociable del proyecto. Hay dos tipos:

**Guardrails de plan** (`run_guardrails()`) — corren sobre un plan nutricional
antes de guardarlo, vía `POST /api/plans`:

- **Rango seguro de calorías**: 1200–3500 kcal/día.
- **Consistencia macros↔calorías**: `proteína×4 + carbohidratos×4 + grasa×9` debe
  coincidir con las calorías declaradas (±10%).
- **Explicabilidad clínica**: cada comida necesita un `why` no vacío y con
  contenido mínimo — es un pilar del proyecto, no solo un campo de texto libre.
- **Compatibilidad por condición clínica** (`app/guardrails/rules.py`): el usuario
  declara sus condiciones como una lista de slugs fijos (`clinicalProfile.pathologies`,
  ej. `diabetes_tipo_2`, `enfermedad_renal`) desde el formulario de registro — no es
  texto libre. Cada condición puede traer su propio tope (ej. diabetes → tope de
  carbohidratos diarios; enfermedad renal → tope de proteína), y si el usuario tiene
  varias a la vez, se revisan todos los topes aplicables.

**Guardrails de perfil** (`run_profile_guardrails()`) — corren sobre el perfil del
usuario al crearlo o editarlo (`POST`/`PUT /api/users`):

- **Velocidad de progreso agresiva bloqueada con condición clínica**: si
  `goalProfile.progressSpeed` es `"agresivo"` y el usuario declaró una condición
  clínica relevante, se rechaza con 422 — tal como pidió el backlog original
  ("tu algoritmo debe bloquear opciones agresivas si el usuario tiene condiciones
  clínicas previas").

Si algún guardrail bloqueante falla, el endpoint responde `422` con el detalle de
cada violación en vez de guardar. Además, el propio modelo Pydantic
(`app/models/plan.py`) exige macros no negativos, calorías positivas y al menos
una comida — la primera línea de defensa antes de que corran los guardrails.

Pruébalos de forma aislada (no requieren MongoDB):

```bash
pytest tests/test_guardrails.py -v
```

**Limitación conocida:** el modelo de plan no tiene nutrición por alimento (eso es
trabajo de la validación con OpenFoodFacts, todavía no implementada), así que las
reglas por condición operan sobre macros totales del día, no por ingrediente. Las
alergias (`dietaryProfile.allergies`) se guardan como restricción dura declarada,
pero todavía no hay nada que las compare contra los ingredientes de un plan —
eso requiere que los planes referencien alimentos reales (vía OpenFoodFacts/SMAE)
en vez de texto libre, lo cual es trabajo de Fase 3/4.

**⚠️ `PUT /api/users/{id}` reemplaza el perfil completo, no lo combina.** Si mandas
solo `{"name": "Ana"}`, el resto de los campos (antropometría, perfil clínico, etc.)
se resetean a sus valores vacíos por defecto. La app siempre manda el objeto
completo (ver `src/screens/OnboardingScreen.js`), así que en el flujo normal no pasa
nada raro — pero si vas a llamar este endpoint directamente (ej. con curl o Postman),
manda el perfil completo, no solo el campo que quieres cambiar.

## Fine-tuning QLoRA (Actividad 2) — dataset + notebook

**Estado: scaffolding listo, entrenamiento real todavía no corrido con un
dataset grande.** Esta es la actividad que faltaba por completo (el resto del
proyecto hasta ahora es la Fase 3 "parte 1": RAG sobre un modelo sin afinar).

Dos piezas, pensadas para trabajar juntas:

1. **`scripts/generate_finetune_dataset.py`** (este backend) — genera el
   dataset de entrenamiento por **destilación**: usa el mismo pipeline de RAG
   que `POST /api/plans/generate` (misma recuperación de fichas, mismo
   `SYSTEM_PROMPT`, mismo Llama 3.3 70B vía Together.ai) sobre perfiles de
   usuario **sintéticos pero realistas** (mismos slugs/valores que acepta el
   formulario real de registro), y solo guarda los ejemplos que **sí pasan
   `run_guardrails()`** — el dataset de fine-tuning queda filtrado por la
   misma capa de seguridad clínica que protege un plan real, no es texto
   libre sin validar. Corre desde `backend/`:

   ```bash
   python scripts/generate_finetune_dataset.py --count 10   # prueba chica (ya corrida, ver abajo)
   python scripts/generate_finetune_dataset.py --count 150  # dataset real para entrenar en serio
   ```

   Guarda `data/training/plans_train.jsonl` y `plans_val.jsonl` (90/10),
   formato chat (`{"messages": [system, user, assistant]}`) listo para
   `tokenizer.apply_chat_template` de Llama 3.1. Los ejemplos rechazados por
   guardrails se guardan aparte en `data/training/rejected_examples.jsonl`
   (para poder revisar por qué, no se usan para entrenar).

   **Control de gasto** (Together.ai es prepago): el
   script imprime el gasto estimado conforme genera y se detiene solo si pasa
   `--max-cost-usd` (default $3.00 de los ~$5 cargados). El precio por millón
   de tokens es un estimado configurable (`--price-per-million-tokens`,
   default 0.88) — **verifica el precio real vigente en
   together.ai/pricing antes de correr un `--count` grande**, el script no lo
   consulta solo.

   **Probado en vivo**: una corrida de `--count 3` generó 3/3 ejemplos
   aceptados (ningún rechazo por guardrails), con porciones y modo de
   preparación ya incluidos en cada alimento (ver la regla 8 del
   `SYSTEM_PROMPT` en "Motor RAG" arriba) — el pipeline de generación +
   filtrado funciona de punta a punta.

2. **`notebooks/finetune_llama31_8b_qlora.ipynb`** — el entrenamiento QLoRA
   real sobre **Llama 3.1 8B** (no el 70B del RAG — ese no cabe en la GPU
   gratuita de Colab). Es un notebook, no un script de este backend, porque
   necesita GPU. Carga el dataset generado arriba, afina con
   `peft`/`bitsandbytes`/`trl` (LoRA r=16, 4-bit), guarda el adaptador, y
   termina con una celda de comparación **antes/después** sobre el mismo
   prompt — esa comparación es la evidencia que pide la Actividad 5
   (pruebas y validación).

**Siguiente paso real:** correr `generate_finetune_dataset.py` con un
`--count` grande (150-300) para tener un dataset que de verdad mueva la
aguja al entrenar, y luego correr el notebook completo en Colab.

## Notas de diseño

- Los modelos Pydantic exponen JSON en camelCase (`goalProfile`,
  `anthropometrics`, etc.) para coincidir con las convenciones de la app móvil.
- El perfil de usuario (`app/models/user.py`) agrupa los ~30 campos del registro en
  sub-modelos temáticos (`anthropometrics`, `activityLevel`, `goalProfile`,
  `clinicalProfile`, `dietaryProfile`, `lifestyleProfile`, `flexibilityProfile`) en
  vez de un solo objeto plano — más fácil de mantener y de mapear 1:1 con los pasos
  del formulario de registro en la app.
- Las rutas de círculos de apoyo y gamificación no están aquí todavía: son
  alcance extendido, no núcleo.
- El fine-tuning con QLoRA (Actividad 2 / Fase 3 parte 2) todavía no se ha hecho —
  `POST /api/plans/generate` usa RAG sobre el modelo base (Llama 3.3 70B), no un
  modelo afinado. Ver la sección "Motor RAG" arriba.

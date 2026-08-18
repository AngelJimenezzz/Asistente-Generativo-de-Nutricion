# Proyecto: Asistente Generativo de Nutrición de Precisión

Tesis — Universidad de Colima, Facultad de Telemática. Este archivo es el puente de
contexto entre las sesiones de planeación (claude.ai) y el trabajo de código aquí en
Claude Code. Léelo completo antes de proponer cambios de arquitectura o alcance.

## Objetivo del proyecto

App móvil que usa IA generativa para generar planes nutricionales personalizados,
basados en evidencia científica, condiciones clínicas y preferencias del usuario.
Justificación: democratizar el acceso a nutrición de calidad frente al alto costo de
consulta privada, priorizando seguridad clínica sobre velocidad de desarrollo.

## Decisiones de arquitectura (ya tomadas — no reabrir sin discutirlo primero)

- **Fine-tuning con LoRA/QLoRA**, no fine-tuning completo. Por esto, el modelo base
  debe ser **open-weight** (Llama 3 8B o Mistral 7B) — GPT queda descartado para esta
  parte porque OpenAI no expone pesos para LoRA/QLoRA.
- **RAG** sobre una base de conocimiento clínico-nutricional verificada, para que el
  modelo fundamente respuestas en datos reales y no en lo que "recuerda".
- **Guardrails deterministas en Pydantic**: toda respuesta del LLM se valida (macros,
  calorías, compatibilidad con condiciones clínicas) antes de mostrarse al usuario.
  Esta es la capa de seguridad no negociable del proyecto.
- **OpenFoodFacts como fuente de verdad** para alimentos reales, en vez de dejar que
  el LLM invente productos o valores nutricionales.

## Stack tecnológico

| Componente | Tecnología |
|---|---|
| Backend | Python 3.11+, FastAPI, Uvicorn, Pydantic, Motor/PyMongo |
| Base de datos | MongoDB Atlas |
| Modelo | Llama 3 8B o Mistral 7B (open-weight) |
| Fine-tuning | LoRA/QLoRA — Hugging Face `transformers`, `peft`, `bitsandbytes`, `trl` (GPU gratuita en Colab) |
| RAG | LangChain o LlamaIndex |
| Datos de alimentos | API de OpenFoodFacts |
| App móvil | React Native + Expo, Node.js |

## Alcance

**Núcleo (se implementa y se valida):** generación de planes, fine-tuning LoRA + RAG,
guardrails, validación con OpenFoodFacts, explicabilidad clínica.

**Extendido (según tiempo disponible):** simulador de escenarios sociales ("Plan B"),
sustitución de alimentos por presupuesto/disponibilidad, círculos de apoyo, gamificación.

**Fuera de alcance / trabajo futuro (documentar, no implementar):** micro-ajustes
adaptativos por retroalimentación sensorial (fatiga, distensión, saciedad) — se dejó
fuera por acercarse demasiado a decisiones clínicas automatizadas sin supervisión
profesional. Integración con wearables.

## Principios de diseño no negociables

- El módulo social (círculos de apoyo) y la gamificación se basan en **hábitos y
  constancia** (rachas de uso, retos de comportamiento), **nunca** en peso, medidas
  corporales o comparaciones físicas. Esto es una decisión de seguridad, no estética
  — está respaldado por evidencia de que ese tipo de comparación social se asocia a
  insatisfacción corporal y trastornos alimenticios.
- Círculos pequeños (5-15 personas), no feed público abierto.
- Toda funcionalidad social/de compartir es opt-in.
- La app se comunica siempre como herramienta de apoyo, nunca como sustituto de un
  profesional de la salud.

## Estado actual del proyecto

- ✅ Documento de requerimientos redactado (`docs/requerimientos.docx` si lo agregas al repo)
- ✅ Starter de la app móvil: navegación (5 tabs) y pantallas núcleo con datos mock
  en `App.js` + `src/` — construidas en claude.ai, ya en este repo
- ⬜ Backend (FastAPI + MongoDB) — no iniciado
- ⬜ Pipeline RAG + fine-tuning LoRA — no iniciado
- ⬜ Conectar la app a endpoints reales (hoy usa `src/data/mockData.js`)

## Roadmap de fases (referencia)

Fase 0 Planeación → Fase 1 Datos → Fase 2 Backend base → Fase 3 Motor de IA
(fine-tuning + RAG + guardrails) → Fase 4 Diferenciadores → Fase 5 App móvil →
Fase 6 Pruebas → Fase 7 Documentación (continua).

## Flujo de trabajo

Las decisiones de alcance, arquitectura y diseño se discuten primero en claude.ai
(sesiones de planeación con contexto de tesis). Este archivo se actualiza manualmente
cuando algo cambia ahí — si tomas una decisión importante en Claude Code que contradiga
algo de este archivo, dilo explícitamente en vez de sobreescribirlo en silencio.

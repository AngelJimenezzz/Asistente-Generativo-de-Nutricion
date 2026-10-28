# Asistente Generativo de Nutrición de Precisión

App móvil (React Native + Expo) con un backend propio (FastAPI + MongoDB) que genera
planes nutricionales personalizados usando un modelo de lenguaje con RAG (recuperación
aumentada por generación) sobre una base de conocimiento clínico curada, validados por
una capa de guardrails deterministas antes de mostrarse al usuario.

**🔗 Demo en vivo:** [próximamente](#) — versión web, cualquiera puede probarla sin instalar nada.

> Proyecto de tesis de Ingeniería de Software (Universidad de Colima). Alcance en
> desarrollo activo — ver la sección "Qué falta" al final.

## Qué hace

1. El usuario captura su perfil completo (condiciones de salud, alergias, filosofía
   alimentaria, presupuesto, objetivos, estilo de vida) en un registro de 7 pasos.
2. Al pedir su plan del día, el backend recupera las fichas clínicas relevantes para su
   condición desde una base de conocimiento curada (NOM, OMS, Sistema Mexicano de
   Alimentos Equivalentes), se las da al modelo de lenguaje junto con su perfil completo,
   y genera un plan de comidas con porciones, modo de preparación y explicación clínica
   de cada elección.
3. **Antes de guardarse o mostrarse**, el plan pasa por una capa de validación
   determinista (sin IA) que lo rechaza si excede un límite calórico seguro, si los
   macronutrientes no cuadran con las calorías declaradas, si falta una explicación
   clínica, o si excede el límite de carbohidratos/proteína asociado a la condición del
   usuario. Esta capa existe porque la salida de un modelo de lenguaje nunca se considera
   verificada por sí misma en un contexto de salud.
4. El plan se genera **un día a la vez, no la semana completa** — es una decisión de
   producto deliberada para que la persona vuelva a abrir la app todos los días, en vez
   de armar la semana de un jalón y no volver a entrar.

## Funcionalidad

- **Registro completo** (antropometría, objetivo, perfil clínico, dietético, estilo de
  vida, flexibilidad) con guardrails de perfil (ej. bloquea una meta "agresiva" si hay
  una condición clínica declarada).
- **Generación de plan diario con IA**, con recuperación de evidencia clínica (RAG) y
  guardrails deterministas antes de guardar.
- **Cambiar una sola comida** sin regenerar el día completo, si no te gustó una en
  particular.
- **Chat con el asistente** — conoce tu plan actual y tu perfil, y remite a un
  profesional de salud ante preguntas clínicas en vez de responderlas él mismo.
- **"Tengo una salida con amigos"** y **"Ajustar por presupuesto/disponibilidad"** —
  consejos puntuales generados con el mismo motor de IA para situaciones reales
  (comer fuera, presupuesto limitado).
- **Búsqueda real de alimentos** vía la API de OpenFoodFacts (con caché y degradación
  segura si el servicio externo falla).
- **Lista de compras** consolidada automáticamente a partir de los días generados.
- **Modo sin conexión**: si no hay red, muestra el último plan guardado en el
  dispositivo en vez de dejar al usuario sin nada.
- **Exportar a PDF/Excel.**
- **Recordatorio diario** (notificación local) y una racha de días de uso — **sin
  medallas, sin logros, sin comparación entre usuarios**: se descartó a propósito un
  sistema de gamificación basado en recompensas, por la evidencia de que ese tipo de
  mecánica puede incitar trastornos alimenticios.

## Arquitectura

```
App (React Native + Expo)  ──HTTP/JSON──▶  Backend (FastAPI)
                                               │
                        ┌──────────────────────┼──────────────────────┐
                        ▼                      ▼                      ▼
                    MongoDB              Modelo de lenguaje      OpenFoodFacts
                 (usuarios, planes)      (RAG + guardrails)      (alimentos reales)
```

- **Frontend**: React Native + Expo (SDK 58), navegación por pestañas, contextos de
  React para estado compartido (perfil, plan).
- **Backend**: FastAPI + Motor (MongoDB async) + Pydantic. Organizado por dominio
  (usuarios, planes, chat, consejos, alimentos), con un motor de guardrails clínicos
  independiente y 100% determinista.
- **RAG**: recuperación por etiqueta de condición clínica (sin embeddings — el corpus es
  pequeño y ya viene curado/etiquetado, así que una búsqueda semántica no aporta nada).
- **Modelo de lenguaje**: servido vía Together.ai mientras se completa el ajuste fino
  propio (ver "Qué falta").

## Cómo correrlo localmente

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
copy .env.example .env         # Windows: copy · macOS/Linux: cp
# llena MONGODB_URI y TOGETHER_API_KEY en .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Necesitas: una base de MongoDB (local o [Atlas](https://www.mongodb.com/atlas), capa
gratuita M0 es suficiente) y una cuenta de [Together.ai](https://api.together.ai) (de
pago por uso, prepago) para la generación de planes con IA.

Pruebas del backend: `pytest -q` desde `backend/`.

### App móvil

```bash
npm install
npx expo start
```

Escanea el QR con **Expo Go** (Android/iOS). Si tu backend corre en otra máquina/puerto,
crea un `.env` en la raíz con `EXPO_PUBLIC_API_URL=http://tu-host:8000`.

### Versión web

```bash
npx expo export --platform web
```

Genera un sitio estático en `dist/` (así es como se despliega la demo en vivo). Algunas
funciones nativas (notificaciones locales, exportar a PDF/Excel) dependen de APIs que no
existen en el navegador y pueden no estar disponibles en esa versión.

## Qué falta

Documentado explícitamente, no escondido:

- **Fine-tuning del modelo** (LoRA/QLoRA sobre Llama 3.1 8B) — el pipeline de generación
  de dataset por destilación ya existe y está probado; el entrenamiento en sí todavía no
  se ha corrido a escala completa.
- **Círculos de apoyo** — pantalla construida, pero todavía con datos de ejemplo; su
  backend propio (membresía, publicaciones) no está implementado.
- **Pruebas de usabilidad con usuarios externos** al equipo de desarrollo.
- **Interpretación automática de síntomas/medicamentos declarados en texto libre** — se
  dejó fuera a propósito (no automatizado): es una decisión clínica que requiere
  supervisión profesional, no solo validación determinista.

## Seguridad / privacidad del demo público

La versión desplegada es solo para fines de portafolio. No ingreses información de salud
real — usa datos de ejemplo. Los endpoints que llaman al modelo de lenguaje tienen un
límite de uso por IP para evitar abuso del servicio de pago.

## Licencia

MIT — ver [LICENSE](LICENSE).

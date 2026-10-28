// Catálogos de opciones para el formulario de registro (onboarding).
// Los `value` deben coincidir exactamente con los slugs que espera el backend
// (ver backend/app/models/user.py y backend/app/guardrails/rules.py).

export const BIOLOGICAL_SEX_OPTIONS = [
  { value: 'femenino', label: 'Femenino' },
  { value: 'masculino', label: 'Masculino' },
];

export const EXERCISE_DAYS_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7];

export const WORK_ACTIVITY_OPTIONS = [
  { value: 'sedentario', label: 'Sedentario (oficina, escritorio)' },
  { value: 'de_pie', label: 'De pie la mayor parte del día' },
  { value: 'trabajo_fisico', label: 'Trabajo físico / esfuerzo manual' },
];

export const PRIMARY_GOAL_OPTIONS = [
  { value: 'perdida_grasa', label: 'Pérdida de grasa' },
  { value: 'ganancia_muscular', label: 'Ganancia muscular' },
  { value: 'recomposicion', label: 'Recomposición corporal' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'rendimiento_deportivo', label: 'Rendimiento deportivo' },
  { value: 'control_salud', label: 'Control de salud / enfermedad' },
];

export const PROGRESS_SPEED_OPTIONS = [
  { value: 'lento', label: 'Lento y sostenible' },
  { value: 'moderado', label: 'Moderado' },
  { value: 'agresivo', label: 'Agresivo / rápido' },
];

export const PATHOLOGY_OPTIONS = [
  { value: 'diabetes_tipo_1', label: 'Diabetes tipo 1' },
  { value: 'diabetes_tipo_2', label: 'Diabetes tipo 2' },
  { value: 'resistencia_insulina', label: 'Resistencia a la insulina' },
  { value: 'hipertension', label: 'Hipertensión' },
  { value: 'sop', label: 'Síndrome de ovario poliquístico (SOP)' },
  { value: 'hipotiroidismo', label: 'Hipotiroidismo' },
  { value: 'higado_graso', label: 'Hígado graso' },
  { value: 'enfermedad_renal', label: 'Enfermedad renal' },
];

export const DIGESTIVE_CONDITION_OPTIONS = [
  { value: 'sensibilidad_gluten', label: 'Sensibilidad al gluten' },
  { value: 'sii_fodmap', label: 'Síndrome de intestino irritable (FODMAPs)' },
  { value: 'reflujo', label: 'Reflujo' },
];

export const ALLERGY_OPTIONS = [
  { value: 'cacahuates', label: 'Cacahuates' },
  { value: 'nueces', label: 'Nueces' },
  { value: 'mariscos', label: 'Mariscos' },
  { value: 'huevo', label: 'Huevo' },
  { value: 'lacteos', label: 'Lácteos / lactosa' },
  { value: 'soya', label: 'Soya' },
  { value: 'gluten', label: 'Gluten' },
];

export const DIET_PHILOSOPHY_OPTIONS = [
  { value: 'omnivoro', label: 'Omnívoro' },
  { value: 'vegetariano', label: 'Vegetariano' },
  { value: 'vegano', label: 'Vegano' },
  { value: 'pescetariano', label: 'Pescetariano' },
  { value: 'keto', label: 'Keto' },
  { value: 'ayuno_intermitente', label: 'Ayuno intermitente' },
];

export const BUDGET_TIER_OPTIONS = [
  { value: 'economico', label: 'Económico' },
  { value: 'estandar', label: 'Estándar' },
  { value: 'premium', label: 'Premium / orgánico' },
];

export const KITCHEN_EQUIPMENT_OPTIONS = [
  { value: 'licuadora', label: 'Licuadora' },
  { value: 'horno', label: 'Horno' },
  { value: 'microondas', label: 'Microondas' },
  { value: 'freidora_aire', label: 'Freidora de aire' },
  { value: 'estufa', label: 'Estufa' },
];

export const COOKING_TIME_OPTIONS = [
  { value: 'menos_15_min', label: 'Menos de 15 min' },
  { value: '30_min', label: '30 min' },
  { value: 'tengo_tiempo', label: 'Tengo tiempo libre' },
];

export const MEALS_PER_DAY_OPTIONS = [2, 3, 4, 5];

export const STRICTNESS_OPTIONS = [
  { value: 'flexible', label: 'Flexible' },
  { value: 'moderado', label: 'Moderado' },
  { value: 'estricto', label: 'Estricto' },
];

export const FLAVOR_PREFERENCE_OPTIONS = [
  { value: 'dulce', label: 'Dulce' },
  { value: 'salado', label: 'Salado' },
  { value: 'ambos', label: 'Ambos' },
];

// País del usuario — no estado/provincia. La idea es que el sistema pueda
// adaptar culturalmente las sugerencias de alimentos (ingredientes típicos,
// nombres locales) si algún día alguien fuera de México usa la app.
// México va primero porque es el mercado principal del proyecto.
export const COUNTRIES = [
  'México',
  'Argentina', 'Bolivia', 'Chile', 'Colombia', 'Costa Rica', 'Cuba',
  'Ecuador', 'El Salvador', 'España', 'Estados Unidos', 'Guatemala',
  'Honduras', 'Nicaragua', 'Panamá', 'Paraguay', 'Perú',
  'Puerto Rico', 'República Dominicana', 'Uruguay', 'Venezuela',
  'Otro país',
];

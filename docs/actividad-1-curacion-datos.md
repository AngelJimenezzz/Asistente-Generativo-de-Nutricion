# Actividad 1 — Recopilación y Curación de Datos

> Obtención de datasets de nutrición clínica y conexión con la API de OpenFoodFacts
> para garantizar una base de datos de alimentos actualizada.

Esta actividad tiene dos componentes independientes que alimentan partes distintas
del sistema:

| Componente | Alimenta | Entregable |
|---|---|---|
| A. Base de conocimiento clínico | Pipeline RAG (Fase 3) | `data/clinical/knowledge_base.json` |
| B. Base de alimentos | Validación de recomendaciones | `app/services/openfoodfacts.py` |

---

## A. Curación de la base de conocimiento clínico

### Criterios de inclusión

Se estableció un criterio estricto de fuentes para que el asistente pueda citar el
origen de cada recomendación:

- **Solo fuentes oficiales**: Normas Oficiales Mexicanas (NOM), guías de la OMS/FAO
  y publicaciones de asociaciones clínicas reconocidas.
- **Se excluye** literatura divulgativa, blogs, y cualquier fuente sin respaldo
  institucional verificable.
- **Trazabilidad obligatoria**: cada fragmento almacena su fuente, de modo que el
  sistema RAG pueda mostrar de dónde proviene cada afirmación.

### Fuentes seleccionadas

| Fuente | Emisor | Uso en el proyecto |
|---|---|---|
| NOM-043-SSA2-2012 | Secretaría de Salud | Orientación alimentaria general, Plato del Bien Comer |
| NOM-015-SSA2-2010 | Secretaría de Salud | Manejo nutricional en diabetes mellitus |
| NOM-030-SSA2-2009 | Secretaría de Salud | Restricción de sodio en hipertensión |
| Guideline: Sodium intake | OMS | Límite superior de sodio en población general |
| Guideline: Sugars intake | OMS | Límite de azúcares libres |
| Sistema Mexicano de Alimentos Equivalentes | Fomento de Nutrición y Salud A.C. | Sustitución de alimentos (Fase 4) |
| Human energy requirements | FAO/OMS/UNU | Ecuaciones de gasto energético |

**Decisión de diseño:** se priorizaron normas mexicanas sobre guías internacionales
equivalentes, porque el proyecto está dirigido explícitamente a población mexicana
y porque el etiquetado frontal de advertencia mexicano ofrece un criterio objetivo
de calidad nutricional que no existe en otros marcos normativos.

### Estructura de los documentos

Cada fragmento de la base de conocimiento se estructuró con un campo
`aplicacion_guardrail` que conecta explícitamente el conocimiento clínico con la
regla determinista que lo hace cumplir. Esto resuelve un problema central del
proyecto: que las respuestas del modelo generativo no solo *citen* la guía clínica,
sino que sean *verificables* contra ella antes de mostrarse al usuario.

Ejemplo:

```json
{
  "condicion": "hipertension",
  "contenido": "En pacientes con hipertensión se recomienda una restricción
                de sodio por debajo de 1500 mg diarios...",
  "fuente_id": "nom-030",
  "aplicacion_guardrail": "Aplicar tope de 1500 mg de sodio diarios cuando el
                           usuario declare hipertensión."
}
```

### Limitación reconocida

Los rangos incluidos son referencias poblacionales generales. La individualización
clínica (ajuste por peso, función renal, medicación, comorbilidades) corresponde al
profesional tratante. El sistema comunica esta limitación explícitamente al usuario
y no sustituye la valoración profesional.

---

## B. Conexión con la API de OpenFoodFacts

### Por qué OpenFoodFacts

El problema central que resuelve: **evitar que el modelo generativo invente
alimentos o valores nutricionales**. En lugar de que el LLM produzca "100 g de
avena tienen X calorías" desde su memoria paramétrica, el sistema consulta un
producto real y usa sus valores verificados.

Los datos se publican bajo Open Database License (ODbL), que permite el reuso con
atribución — la app debe acreditar a Open Food Facts.

### Restricciones técnicas identificadas

Se documentaron tres restricciones de la API que condicionaron el diseño:

**1. Límite de peticiones.** OpenFoodFacts limita las consultas de búsqueda a
aproximadamente 10 por minuto por dirección IP. Superarlo puede resultar en bloqueo.

> **Decisión:** se implementó caché obligatorio en MongoDB con TTL de 7 días. Los
> valores nutricionales de un producto empaquetado cambian con muy baja frecuencia,
> por lo que un TTL semanal es seguro y reduce drásticamente las llamadas salientes.

**2. La API v2 no soporta búsqueda por texto libre.** Solo permite búsqueda
estructurada por categoría, marca, país o valores nutricionales. La búsqueda por
texto sigue disponible únicamente en el endpoint heredado v1 (`/cgi/search.pl`).

> **Decisión:** el cliente usa ambos endpoints según el caso de uso — v2 para código
> de barras y búsqueda por categoría (que es como consultará el motor de IA), v1
> para búsqueda por texto del usuario. Se documenta explícitamente que la búsqueda
> por texto **no debe** usarse como *search-as-you-type* por el límite de peticiones.

**3. Completitud variable de los datos.** Al ser una base colaborativa, muchos
productos carecen de información nutricional completa, y algunos campos numéricos
llegan como cadenas de texto o vacíos.

> **Decisión:** la función de normalización nunca lanza excepción ante datos
> malformados, y marca cada producto con una bandera `has_minimum_nutrition_data`.
> Un producto sin energía, proteína, carbohidratos y grasa **no puede usarse** para
> calcular un plan — el sistema lo excluye en lugar de asumir ceros, lo que
> generaría un plan nutricionalmente inseguro.

### Decisiones adicionales

- **Instancia de México (`mx.openfoodfacts.org`)**: prioriza productos disponibles
  en el mercado mexicano, coherente con el objetivo de impacto social del proyecto.
- **Selección explícita de campos (`fields=`)**: un registro completo de OFF puede
  superar los 200 KB; se solicitan solo los campos que el motor nutricional usa.
- **User-Agent identificable**: OpenFoodFacts lo solicita explícitamente a quienes
  reusan la API, para poder contactar al desarrollador ante cualquier problema.
- **Conversión de unidades**: OFF entrega el sodio en gramos, pero las guías
  clínicas (OMS, NOM-030) expresan los límites en miligramos. La normalización
  convierte a mg para que los guardrails comparen contra la misma unidad.
- **Degradación segura**: si OpenFoodFacts no responde, el endpoint devuelve 503
  explícitamente en lugar de datos incompletos o inventados.

### Endpoints implementados

| Método | Endpoint | Uso |
|---|---|---|
| GET | `/api/foods/barcode/{barcode}` | Escaneo de producto desde la app móvil |
| GET | `/api/foods/search?q=` | Búsqueda por texto del usuario |
| GET | `/api/foods/category/{category}` | **Uso principal del motor de IA (Fase 3)** |

El endpoint de categoría es el que cierra el ciclo de la arquitectura: el modelo
sugiere una *categoría* de alimento ("breakfast cereals") y el backend devuelve
productos *reales* de esa categoría, con sus valores nutricionales verificados.

---

## Verificación

Se implementaron 15 pruebas unitarias (`tests/test_openfoodfacts.py`) que cubren:

- Normalización de productos completos e incompletos
- Extracción correcta de valores nutricionales
- Conversión de unidades (sodio de g a mg)
- Detección de productos sin datos suficientes
- Preferencia de nombres en español
- Tolerancia a datos malformados (strings, vacíos, texto en campos numéricos)
- Configuración del cliente

Las pruebas usan datos crudos simulados en lugar de consultar la API real, por dos
motivos: no agotar el límite de peticiones de OpenFoodFacts, y garantizar que las
pruebas sean deterministas (los datos colaborativos pueden cambiar entre
ejecuciones).

Se incluye además una prueba de integración marcada que sí consulta la API real,
ejecutable bajo demanda con `pytest -m integration`.

```bash
# Suite normal (sin llamadas a la API)
pytest tests/test_openfoodfacts.py -v

# Prueba de integración contra la API real
pytest -m integration
```

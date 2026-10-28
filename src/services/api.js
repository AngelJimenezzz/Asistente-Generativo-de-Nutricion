import Constants from 'expo-constants';

// Resuelve la URL base del backend FastAPI.
// - EXPO_PUBLIC_API_URL permite apuntar a un backend desplegado (o distinto puerto/host).
// - En dispositivo físico / emulador, se deriva la IP de la máquina que corre
//   `expo start` a partir del hostUri de Metro, para no tener que hardcodear IPs.
function resolveApiBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;

  const hostUri = Constants.expoConfig?.hostUri || Constants.expoGoConfig?.debuggerHost;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:8000`;
  }
  return 'http://localhost:8000';
}

export const API_BASE_URL = resolveApiBaseUrl();

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        // Si el backend está detrás de localtunnel (desarrollo fuera de casa,
        // ver README), esto evita la página de advertencia "¿confías en este
        // túnel?" que localtunnel le pone a peticiones que parecen de
        // navegador — sin este header, la app recibía esa página HTML en vez
        // de la respuesta JSON real. No afecta nada cuando no hay túnel.
        'bypass-tunnel-reminder': 'true',
      },
      ...options,
    });
  } catch (err) {
    throw new Error(
      `No se pudo conectar con la API en ${API_BASE_URL}. ¿Está corriendo el backend (uvicorn --host 0.0.0.0)? — ${err.message}`
    );
  }

  if (!response.ok) {
    let message = `Error ${response.status}`;
    let violations = null;
    try {
      const body = await response.json();
      const detail = body.detail;

      if (Array.isArray(detail)) {
        // Errores de validación estándar de FastAPI/Pydantic (ej. un campo
        // fuera de rango): [{ loc: [...], msg: "...", type: "..." }, ...]
        message = detail
          .map((e) => {
            const field = Array.isArray(e.loc) ? e.loc[e.loc.length - 1] : null;
            return field ? `${field}: ${e.msg}` : e.msg;
          })
          .join(' · ');
      } else if (detail && typeof detail === 'object') {
        // 422 de guardrails de plan/perfil: { message, violations: [...] }
        // 422 de guardrails semanales: { message, days: [{ dayIndex, violations }] }
        message = detail.message || message;
        if (Array.isArray(detail.violations)) {
          violations = detail.violations;
        } else if (Array.isArray(detail.days)) {
          violations = detail.days.flatMap((d) =>
            (d.violations || []).map((v) => ({ ...v, message: `Día ${d.dayIndex} (${d.dayOfWeek}): ${v.message}` }))
          );
        }
      } else if (detail) {
        message = detail;
      }
    } catch {
      // el cuerpo no era JSON, se usa el mensaje genérico de arriba
    }
    const error = new Error(message);
    error.status = response.status;
    error.violations = violations;
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  createUser: (payload) => request('/api/users', { method: 'POST', body: JSON.stringify(payload) }),
  getUser: (userId) => request(`/api/users/${userId}`),
  updateUser: (userId, payload) => request(`/api/users/${userId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  checkinUser: (userId) => request(`/api/users/${userId}/checkin`, { method: 'POST' }),

  createPlan: (payload) => request('/api/plans', { method: 'POST', body: JSON.stringify(payload) }),
  getPlan: (planId) => request(`/api/plans/${planId}`),
  listPlansForUser: (userId) => request(`/api/plans/user/${userId}`),
  getWeekPlan: (userId) => request(`/api/plans/week/${userId}`),
  generatePlan: (userId) => request(`/api/plans/generate?user_id=${userId}`, { method: 'POST' }),
  swapMeal: (planId, mealId) => request(`/api/plans/${planId}/meals/${mealId}/swap`, { method: 'POST' }),

  searchFoods: (query, limit = 10) =>
    request(`/api/foods/search?q=${encodeURIComponent(query)}&limit=${limit}`),

  sendChatMessage: (userId, messages) =>
    request('/api/chat', { method: 'POST', body: JSON.stringify({ userId, messages }) }),

  getSocialEventAdvice: (userId, situation) =>
    request('/api/advice/social-event', { method: 'POST', body: JSON.stringify({ userId, situation }) }),
  getBudgetAdvice: (userId, situation) =>
    request('/api/advice/budget', { method: 'POST', body: JSON.stringify({ userId, situation }) }),
};

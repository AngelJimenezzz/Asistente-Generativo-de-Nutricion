import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';
import { useUser } from './UserContext';

const CACHE_KEY_PREFIX = 'nutricion:lastPlanDays:';

async function cacheDays(userId, days) {
  try {
    await AsyncStorage.setItem(`${CACHE_KEY_PREFIX}${userId}`, JSON.stringify(days));
  } catch {
    // guardar el caché es una mejora, no algo crítico — si falla, se ignora
  }
}

async function readCachedDays(userId) {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_KEY_PREFIX}${userId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Plan de ejemplo (un solo día) para probar el flujo end-to-end contra el
// backend real sin gastar una llamada real a la IA. Se guarda vía POST
// /api/plans, el mismo endpoint que usaría cualquier captura manual futura.
const TEST_PLAN_TEMPLATE = {
  calories: 1850,
  macros: { protein: 110, carbs: 190, fat: 60 },
  meals: [
    {
      id: '1',
      name: 'Desayuno',
      items: ['Avena con moras y nueces', 'Huevo cocido'],
      why: 'La avena aporta betaglucanos que ayudan a estabilizar tus picos de glucosa matutinos.',
    },
    {
      id: '2',
      name: 'Comida',
      items: ['Pechuga a la plancha', 'Ensalada de nopales', 'Arroz integral'],
      why: 'Combinar fibra y proteína en la comida principal mejora la saciedad y modera la respuesta glucémica.',
    },
    {
      id: '3',
      name: 'Cena',
      items: ['Sopa de lentejas', 'Verduras al vapor'],
      why: 'Las lentejas aportan fibra soluble e índice glucémico bajo, ideales para la noche.',
    },
  ],
};

// Estado del plan de la semana COMPARTIDO entre pantallas (Inicio y Plan).
// Antes cada pantalla tenía su propia copia vía un hook normal, así que
// generar el plan en Inicio no se reflejaba en Plan hasta reiniciar la app —
// un Context centralizado evita ese desfase por construcción: solo hay un
// estado, todas las pantallas leen y escriben el mismo.
const PlanContext = createContext(null);

export function PlanProvider({ children }) {
  const { user } = useUser();
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  // true cuando lo que se está mostrando es el último plan guardado en el
  // dispositivo porque no se pudo contactar al backend (sin internet, backend
  // caído, etc.) — no cuando simplemente no hay plan todavía.
  const [offline, setOffline] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const week = await api.getWeekPlan(user.id);
      setDays(week);
      setOffline(false);
      cacheDays(user.id, week);
    } catch (err) {
      const cached = await readCachedDays(user.id);
      if (cached && cached.length > 0) {
        setDays(cached);
        setOffline(true);
        setError(null);
      } else {
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setDays([]); // al cerrar sesión, no dejar el plan del usuario anterior visible
      setOffline(false);
      return;
    }
    refresh();
  }, [user, refresh]);

  const createTestPlan = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const created = await api.createPlan({ userId: user.id, ...TEST_PLAN_TEMPLATE });
      setDays([created]);
      setOffline(false);
      cacheDays(user.id, [created]);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const generatePlanWithAI = useCallback(async () => {
    if (!user) return;
    setGenerating(true);
    setError(null);
    try {
      const week = await api.generatePlan(user.id);
      setDays(week);
      setOffline(false);
      cacheDays(user.id, week);
      return week;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setGenerating(false);
    }
  }, [user]);

  // Reemplaza SOLO una comida dentro de un día ya generado — evita tener que
  // regenerar (y gastar una llamada completa a la IA de) todo el día cuando
  // al usuario no le gustó una sola comida.
  const swapMeal = useCallback(
    async (planId, mealId) => {
      const updatedDay = await api.swapMeal(planId, mealId);
      setDays((prev) => {
        const next = prev.map((day) => (day.id === planId ? updatedDay : day));
        if (user) cacheDays(user.id, next);
        return next;
      });
      return updatedDay;
    },
    [user]
  );

  return (
    <PlanContext.Provider
      value={{
        days,
        today: days[0] ?? null,
        loading,
        error,
        refresh,
        createTestPlan,
        generatePlanWithAI,
        generating,
        swapMeal,
        offline,
      }}
    >
      {children}
    </PlanContext.Provider>
  );
}

export function useWeekPlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('useWeekPlan debe usarse dentro de <PlanProvider>');
  return ctx;
}

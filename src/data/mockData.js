// Datos de ejemplo — se reemplazan por llamadas reales a tu API de FastAPI
// cuando el backend (Fase 2-3 del roadmap) esté listo.

export const mockUser = {
  name: 'Ana',
  condition: 'Prediabetes',
  goal: 'Mejorar control glucémico',
  weeklyBudget: 450, // MXN, ejemplo para el módulo de sustitución por presupuesto
};

export const mockPlan = {
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

export const mockCircle = {
  name: 'Círculo Constancia',
  weeklyChallenge: 'Prueba 3 verduras nuevas esta semana',
  // Nota de diseño: el círculo muestra quién participó en el reto, nunca un
  // número de racha, peso ni medidas corporales.
  members: [
    { id: '1', name: 'Ana', participatedThisWeek: true },
    { id: '2', name: 'Luis', participatedThisWeek: true },
    { id: '3', name: 'Marisol', participatedThisWeek: false },
  ],
};

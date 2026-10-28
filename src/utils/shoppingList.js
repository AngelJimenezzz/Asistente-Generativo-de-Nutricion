// Junta los alimentos de todos los días ya generados en una sola lista de
// compras, sin repetidos. No necesita IA: es puro texto que ya viene en cada
// comida (`meal.items`). La comparación es insensible a mayúsculas/acentos
// para que "Pollo" y "pollo" no aparezcan como dos líneas distintas.
function normalize(text) {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function buildShoppingList(days) {
  const seen = new Map(); // clave normalizada -> texto original (primera aparición)
  for (const day of days || []) {
    for (const meal of day.meals || []) {
      for (const item of meal.items || []) {
        const key = normalize(item);
        if (!seen.has(key)) {
          seen.set(key, item);
        }
      }
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, 'es'));
}

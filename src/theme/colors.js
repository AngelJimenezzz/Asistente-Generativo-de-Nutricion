// Paleta verificada contra WCAG 2.1 AA (texto normal, relación mínima 4.5:1)
// sobre los dos fondos que realmente se usan (`background` y `surface`).
// `textMuted` y `danger` se oscurecieron ligeramente respecto a la versión
// original (que solo pasaba el umbral de "texto grande") — el cambio es casi
// imperceptible a la vista pero sí cambia si pasa o no la auditoría.
export const colors = {
  primary: '#2F6F4E',      // verde: salud, confianza
  primaryLight: '#E7F3EC',
  accent: '#F2A65A',       // acento cálido para detalles puntuales de la UI — no se usa como fondo con texto blanco encima (ahí no pasa el contraste)
  background: '#FAFAF8',
  surface: '#FFFFFF',
  text: '#1F2A24',
  textMuted: '#67756D',
  border: '#E3E8E5',
  danger: '#BD4E3E',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

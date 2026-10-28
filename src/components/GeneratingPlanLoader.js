import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, spacing } from '../theme/colors';

// Mensajes que van rotando mientras se genera el plan — reemplaza al spinner
// genérico que no decía nada mientras la IA tardaba varios segundos (pedido
// explícito: que se sienta que algo está pasando, no que la app se colgó).
const STEPS = [
  'Revisando tu perfil clínico...',
  'Buscando las fichas de nutrición que te aplican...',
  'Armando tus comidas de hoy...',
  'Verificando que todo cumpla tus límites de salud...',
];

const STEP_INTERVAL_MS = 2500;

export default function GeneratingPlanLoader({ style }) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    }, STEP_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.text}>{STEPS[stepIndex]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.md },
  text: { fontSize: 13, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },
});

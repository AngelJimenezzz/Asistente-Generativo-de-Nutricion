import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { StepContainer } from './components';
import {
  PRIMARY_GOAL_OPTIONS, PROGRESS_SPEED_OPTIONS, DIET_PHILOSOPHY_OPTIONS, BUDGET_TIER_OPTIONS,
} from '../../data/onboardingOptions';
import { colors, spacing } from '../../theme/colors';

function labelFor(options, value) {
  return options.find((o) => o.value === value)?.label ?? '—';
}

function SummaryRow({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value || '—'}</Text>
    </View>
  );
}

export default function Step7Review({ data, onSubmit, submitting, submitError }) {
  return (
    <StepContainer title="Revisa tu información" subtitle="Así se guardará tu perfil. Puedes regresar a cualquier paso para corregir algo.">
      <View style={styles.card}>
        <SummaryRow label="Nombre" value={data.name} />
        <SummaryRow label="Edad" value={data.anthropometrics.age} />
        <SummaryRow
          label="Objetivo"
          value={labelFor(PRIMARY_GOAL_OPTIONS, data.goalProfile.primaryGoal)}
        />
        <SummaryRow
          label="Velocidad de progreso"
          value={labelFor(PROGRESS_SPEED_OPTIONS, data.goalProfile.progressSpeed)}
        />
        <SummaryRow
          label="Condiciones clínicas"
          value={data.clinicalProfile.pathologies.length || 'Ninguna declarada'}
        />
        <SummaryRow label="Alergias" value={data.dietaryProfile.allergies.join(', ')} />
        <SummaryRow
          label="Filosofía alimentaria"
          value={labelFor(DIET_PHILOSOPHY_OPTIONS, data.dietaryProfile.dietPhilosophy)}
        />
        <SummaryRow label="Presupuesto" value={labelFor(BUDGET_TIER_OPTIONS, data.lifestyleProfile.budgetTier)} />
        <SummaryRow label="País" value={data.lifestyleProfile.region} />
      </View>

      {submitError && <Text style={styles.errorText}>{submitError}</Text>}

      <Pressable style={styles.submitButton} onPress={onSubmit} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.submitButtonText}>Guardar y continuar</Text>
        )}
      </Pressable>
    </StepContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: { fontSize: 13, color: colors.textMuted, flex: 1 },
  rowValue: { fontSize: 13, color: colors.text, fontWeight: '600', flex: 1, textAlign: 'right' },
  errorText: { fontSize: 13, color: colors.danger, marginBottom: spacing.sm, textAlign: 'center' },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitButtonText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});

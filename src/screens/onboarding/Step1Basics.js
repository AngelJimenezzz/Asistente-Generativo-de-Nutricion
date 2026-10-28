import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { StepContainer, FieldLabel, SingleSelect, TextField } from './components';
import { BIOLOGICAL_SEX_OPTIONS, WORK_ACTIVITY_OPTIONS, EXERCISE_DAYS_OPTIONS } from '../../data/onboardingOptions';
import { colors, spacing } from '../../theme/colors';

export default function Step1Basics({ data, update }) {
  return (
    <StepContainer title="Sobre ti" subtitle="Estos datos ayudan a calcular cuánta energía necesitas al día.">
      <FieldLabel>¿Cómo te llamas?</FieldLabel>
      <TextField value={data.name} onChangeText={(v) => update('name', v)} placeholder="Tu nombre" />

      <FieldLabel>Edad</FieldLabel>
      <TextField
        value={data.anthropometrics.age?.toString() ?? ''}
        onChangeText={(v) => update('anthropometrics.age', v ? parseInt(v, 10) : null)}
        placeholder="Años"
        keyboardType="number-pad"
      />

      <FieldLabel>Sexo biológico</FieldLabel>
      <SingleSelect
        options={BIOLOGICAL_SEX_OPTIONS}
        value={data.anthropometrics.biologicalSex}
        onChange={(v) => update('anthropometrics.biologicalSex', v)}
      />

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <FieldLabel>Estatura (cm)</FieldLabel>
          <TextField
            value={data.anthropometrics.heightCm?.toString() ?? ''}
            onChangeText={(v) => update('anthropometrics.heightCm', v ? parseFloat(v) : null)}
            placeholder="170"
            keyboardType="decimal-pad"
          />
        </View>
        <View style={{ flex: 1 }}>
          <FieldLabel>Peso (kg)</FieldLabel>
          <TextField
            value={data.anthropometrics.weightKg?.toString() ?? ''}
            onChangeText={(v) => update('anthropometrics.weightKg', v ? parseFloat(v) : null)}
            placeholder="70"
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      <FieldLabel>Tu actividad durante el trabajo/día</FieldLabel>
      <SingleSelect
        options={WORK_ACTIVITY_OPTIONS}
        value={data.activityLevel.workActivity}
        onChange={(v) => update('activityLevel.workActivity', v)}
      />

      <FieldLabel>Días de ejercicio planeado por semana</FieldLabel>
      <View style={styles.daysRow}>
        {EXERCISE_DAYS_OPTIONS.map((n) => {
          const selected = data.activityLevel.exerciseDaysPerWeek === n;
          return (
            <Pressable
              key={n}
              style={[styles.dayButton, selected && styles.dayButtonSelected]}
              onPress={() => update('activityLevel.exerciseDaysPerWeek', n)}
            >
              <Text style={[styles.dayButtonText, selected && styles.dayButtonTextSelected]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>

      <FieldLabel>¿Qué tipo de ejercicio? (opcional)</FieldLabel>
      <TextField
        value={data.activityLevel.exerciseType}
        onChangeText={(v) => update('activityLevel.exerciseType', v)}
        placeholder="Ej. pesas, correr, fútbol..."
      />
    </StepContainer>
  );
}

const styles = StyleSheet.create({
  daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dayButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dayButtonSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  dayButtonText: { fontSize: 14, fontWeight: '700', color: colors.text },
  dayButtonTextSelected: { color: colors.primary },
});

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { StepContainer, FieldLabel, SingleSelect, MultiSelect } from './components';
import {
  BUDGET_TIER_OPTIONS,
  KITCHEN_EQUIPMENT_OPTIONS,
  COOKING_TIME_OPTIONS,
  MEALS_PER_DAY_OPTIONS,
} from '../../data/onboardingOptions';
import { colors, spacing } from '../../theme/colors';

export default function Step5Lifestyle({ data, update }) {
  const lifestyle = data.lifestyleProfile;

  return (
    <StepContainer title="Tu estilo de vida" subtitle="Para que el plan sea realista con lo que tienes disponible.">
      <FieldLabel>Presupuesto</FieldLabel>
      <SingleSelect
        options={BUDGET_TIER_OPTIONS}
        value={lifestyle.budgetTier}
        onChange={(v) => update('lifestyleProfile.budgetTier', v)}
      />

      <FieldLabel>¿Qué tienes en tu cocina?</FieldLabel>
      <MultiSelect
        options={KITCHEN_EQUIPMENT_OPTIONS}
        value={lifestyle.kitchenEquipment}
        onChange={(v) => update('lifestyleProfile.kitchenEquipment', v)}
      />

      <FieldLabel>Tiempo disponible para cocinar</FieldLabel>
      <SingleSelect
        options={COOKING_TIME_OPTIONS}
        value={lifestyle.cookingTime}
        onChange={(v) => update('lifestyleProfile.cookingTime', v)}
      />

      <FieldLabel>Comidas al día</FieldLabel>
      <View style={styles.mealsRow}>
        {MEALS_PER_DAY_OPTIONS.map((n) => {
          const selected = lifestyle.mealsPerDay === n;
          return (
            <Pressable
              key={n}
              style={[styles.mealButton, selected && styles.mealButtonSelected]}
              onPress={() => update('lifestyleProfile.mealsPerDay', n)}
            >
              <Text style={[styles.mealButtonText, selected && styles.mealButtonTextSelected]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
    </StepContainer>
  );
}

const styles = StyleSheet.create({
  mealsRow: { flexDirection: 'row', gap: spacing.sm },
  mealButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  mealButtonSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  mealButtonText: { fontSize: 15, fontWeight: '700', color: colors.text },
  mealButtonTextSelected: { color: colors.primary },
});

import React, { useState } from 'react';
import { View, Text, Pressable, FlatList, Modal, StyleSheet } from 'react-native';
import { StepContainer, FieldLabel, SingleSelect, MultiSelect } from './components';
import {
  BUDGET_TIER_OPTIONS,
  KITCHEN_EQUIPMENT_OPTIONS,
  COOKING_TIME_OPTIONS,
  MEALS_PER_DAY_OPTIONS,
  COUNTRIES,
} from '../../data/onboardingOptions';
import { colors, spacing } from '../../theme/colors';

export default function Step5Lifestyle({ data, update }) {
  const lifestyle = data.lifestyleProfile;
  const [pickerOpen, setPickerOpen] = useState(false);

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

      <FieldLabel>Tu país (para adaptar los alimentos a tu cultura)</FieldLabel>
      <Pressable style={styles.regionButton} onPress={() => setPickerOpen(true)}>
        <Text style={styles.regionButtonText}>{lifestyle.region || 'Selecciona tu país'}</Text>
      </Pressable>

      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Selecciona tu país</Text>
          <FlatList
            data={COUNTRIES}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <Pressable
                style={styles.stateRow}
                onPress={() => {
                  update('lifestyleProfile.region', item);
                  setPickerOpen(false);
                }}
              >
                <Text style={styles.stateText}>{item}</Text>
              </Pressable>
            )}
          />
          <Pressable style={styles.closeButton} onPress={() => setPickerOpen(false)}>
            <Text style={styles.closeButtonText}>Cerrar</Text>
          </Pressable>
        </View>
      </Modal>
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
  regionButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  regionButtonText: { fontSize: 14, color: colors.text },
  modalContainer: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, paddingTop: 60 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  stateRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  stateText: { fontSize: 15, color: colors.text },
  closeButton: { marginTop: spacing.md, alignItems: 'center', padding: spacing.md },
  closeButtonText: { color: colors.primary, fontWeight: '700' },
});

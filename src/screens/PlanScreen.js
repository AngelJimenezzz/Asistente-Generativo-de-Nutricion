import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme/colors';
import { mockPlan } from '../data/mockData';

export default function PlanScreen() {
  const [expandedId, setExpandedId] = useState(null);

  const toggleExplain = (id) => setExpandedId(expandedId === id ? null : id);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Tu plan de hoy</Text>

        {mockPlan.meals.map((meal) => (
          <View key={meal.id} style={styles.card}>
            <Text style={styles.mealName}>{meal.name}</Text>
            {meal.items.map((item, i) => (
              <Text key={i} style={styles.mealItem}>• {item}</Text>
            ))}

            <Pressable onPress={() => toggleExplain(meal.id)} style={styles.whyButton}>
              <Ionicons
                name="bulb-outline"
                size={16}
                color={colors.primary}
              />
              <Text style={styles.whyButtonText}>
                {expandedId === meal.id ? 'Ocultar explicación' : '¿Por qué este alimento?'}
              </Text>
            </Pressable>

            {expandedId === meal.id && (
              <Text style={styles.whyText}>{meal.why}</Text>
            )}
          </View>
        ))}

        {/* Placeholders — se conectan a lógica real cuando exista el backend */}
        <Pressable
          style={styles.actionCard}
          onPress={() =>
            Alert.alert(
              'Plan B',
              'Aquí irá el simulador de escenarios sociales: "Estoy en una comida familiar, ¿cómo ajusto el resto del día?"'
            )
          }
        >
          <Ionicons name="restaurant-outline" size={20} color={colors.primary} />
          <Text style={styles.actionText}>Simular un evento social (Plan B)</Text>
        </Pressable>

        <Pressable
          style={styles.actionCard}
          onPress={() =>
            Alert.alert(
              'Sustitución por presupuesto',
              'Aquí irá el ajuste de tu plan según tu presupuesto semanal o los ingredientes que tengas disponibles.'
            )
          }
        >
          <Ionicons name="wallet-outline" size={20} color={colors.primary} />
          <Text style={styles.actionText}>Ajustar por presupuesto/disponibilidad</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: spacing.xl },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  mealName: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 },
  mealItem: { fontSize: 14, color: colors.text, marginBottom: 2 },
  whyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  whyButtonText: { fontSize: 13, color: colors.primary, marginLeft: 6, fontWeight: '600' },
  whyText: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  actionText: { fontSize: 14, color: colors.text, marginLeft: spacing.sm, fontWeight: '600' },
});

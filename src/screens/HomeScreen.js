import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme/colors';
import { mockUser, mockPlan, mockBadges } from '../data/mockData';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.greeting}>Hola, {mockUser.name} 👋</Text>
        <Text style={styles.subGreeting}>{mockUser.goal}</Text>

        {/* Racha — gamificación basada en constancia, no en peso */}
        <View style={styles.streakCard}>
          <Ionicons name="flame" size={28} color={colors.accent} />
          <View style={{ marginLeft: spacing.sm }}>
            <Text style={styles.streakNumber}>{mockUser.streakDays} días</Text>
            <Text style={styles.streakLabel}>de registro constante</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Tu plan de hoy</Text>
        <View style={styles.card}>
          <Text style={styles.cardText}>
            {mockPlan.calories} kcal · {mockPlan.macros.protein}g prot ·{' '}
            {mockPlan.macros.carbs}g carb · {mockPlan.macros.fat}g grasa
          </Text>
          {mockPlan.meals.map((meal) => (
            <Text key={meal.id} style={styles.mealLine}>
              • {meal.name}: {meal.items[0]}
            </Text>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Logros recientes</Text>
        <View style={styles.badgeRow}>
          {mockBadges.map((b) => (
            <View
              key={b.id}
              style={[styles.badge, b.earned && styles.badgeEarned]}
            >
              <Ionicons
                name={b.earned ? 'trophy' : 'trophy-outline'}
                size={18}
                color={b.earned ? colors.accent : colors.textMuted}
              />
              <Text style={styles.badgeText}>{b.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: spacing.xl },
  greeting: { fontSize: 24, fontWeight: '700', color: colors.text },
  subGreeting: { fontSize: 14, color: colors.textMuted, marginTop: 2, marginBottom: spacing.lg },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  streakNumber: { fontSize: 18, fontWeight: '700', color: colors.text },
  streakLabel: { fontSize: 12, color: colors.textMuted },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  cardText: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.sm },
  mealLine: { fontSize: 14, color: colors.text, marginBottom: 4 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  badgeEarned: { borderColor: colors.accent, backgroundColor: '#FFF6EC' },
  badgeText: { fontSize: 12, color: colors.text, marginLeft: 6 },
});

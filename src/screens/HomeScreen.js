import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme/colors';
import { PRIMARY_GOAL_OPTIONS } from '../data/onboardingOptions';
import { useUser } from '../context/UserContext';
import { useWeekPlan } from '../context/PlanContext';
import GeneratingPlanLoader from '../components/GeneratingPlanLoader';

function goalLabel(primaryGoal) {
  return PRIMARY_GOAL_OPTIONS.find((o) => o.value === primaryGoal)?.label ?? '';
}

export default function HomeScreen() {
  const navigation = useNavigation();
  const { user, loading: userLoading, error: userError, refresh: refreshUser } = useUser();
  const { today: plan, loading: planLoading, error: planError, generatePlanWithAI, generating, offline } = useWeekPlan();

  const handleGenerate = async () => {
    try {
      await generatePlanWithAI();
      navigation.navigate('Plan');
    } catch {
      // si falla, nos quedamos en Inicio mostrando el error — no navegamos
    }
  };

  if (userLoading && !user) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (userError) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>No se pudo cargar tu perfil.</Text>
          <Text style={styles.errorDetail}>{userError.message}</Text>
          <Pressable style={styles.retryButton} onPress={refreshUser}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.greeting}>Hola, {user.name} 👋</Text>
        <Text style={styles.subGreeting}>{goalLabel(user.goalProfile.primaryGoal)}</Text>

        {offline && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={16} color={colors.textMuted} />
            <Text style={styles.offlineBannerText}>
              Sin conexión — mostrando el último plan guardado en tu teléfono.
            </Text>
          </View>
        )}

        {/* Racha de días de uso — nunca de peso ni medidas. Es solo
            información, sin medallas ni comparación con nadie. */}
        <View style={styles.streakCard}>
          <Ionicons name="flame" size={28} color={colors.accent} />
          <View style={{ marginLeft: spacing.sm }}>
            <Text style={styles.streakNumber}>{user.streakDays} días</Text>
            <Text style={styles.streakLabel}>de registro constante</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Tu plan de hoy</Text>
        {planLoading && !plan ? (
          <ActivityIndicator color={colors.primary} style={{ marginBottom: spacing.lg }} />
        ) : plan ? (
          <View style={styles.viewPlanCard}>
            <Text style={styles.viewPlanTitle}>Ya tienes tu plan de hoy</Text>
            <Text style={styles.viewPlanSubtitle}>{plan.calories} kcal · {plan.meals.length} comidas</Text>
            <Pressable style={styles.viewPlanButton} onPress={() => navigation.navigate('Plan')}>
              <Text style={styles.viewPlanButtonText}>Ver mi plan</Text>
              <Ionicons name="chevron-forward" size={18} color="#FFF" />
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardText}>Todavía no tienes un plan para hoy.</Text>
            {generating ? (
              <GeneratingPlanLoader />
            ) : (
              <Pressable style={styles.retryButton} onPress={handleGenerate}>
                <Text style={styles.retryButtonText}>Generar mi plan con IA</Text>
              </Pressable>
            )}
            {planError && <Text style={styles.errorDetail}>{planError.message}</Text>}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: spacing.xl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  errorText: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  errorDetail: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  retryButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-start',
  },
  retryButtonText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
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
  viewPlanCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  viewPlanTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  viewPlanSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md },
  viewPlanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
  },
  viewPlanButtonText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.border,
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  offlineBannerText: { fontSize: 12, color: colors.textMuted, flex: 1 },
});

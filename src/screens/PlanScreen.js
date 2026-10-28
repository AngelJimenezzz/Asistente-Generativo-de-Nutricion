import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme/colors';
import { useUser } from '../context/UserContext';
import { useWeekPlan } from '../context/PlanContext';
import { exportPlanAsPdf, exportPlanAsExcel } from '../utils/exportPlan';
import { api } from '../services/api';
import AdviceModal from '../components/AdviceModal';
import GeneratingPlanLoader from '../components/GeneratingPlanLoader';
import ShoppingListModal from '../components/ShoppingListModal';

export default function PlanScreen() {
  const { user } = useUser();
  const [expandedId, setExpandedId] = useState(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [socialModalOpen, setSocialModalOpen] = useState(false);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [swappingMealId, setSwappingMealId] = useState(null);
  const [swapError, setSwapError] = useState(null);
  const [shoppingListOpen, setShoppingListOpen] = useState(false);
  const [exportError, setExportError] = useState(null);
  const { days, loading, error, createTestPlan, generatePlanWithAI, generating, swapMeal, offline } = useWeekPlan();

  const toggleExplain = (id) => setExpandedId(expandedId === id ? null : id);
  const activeDay = days[Math.min(selectedDay, days.length - 1)] ?? null;

  const handleGenerate = async () => {
    setSelectedDay(0);
    try {
      await generatePlanWithAI();
    } catch {
      // el error ya queda en el estado del hook y se muestra abajo
    }
  };

  const handleSwapMeal = async (meal) => {
    if (!activeDay) return;
    setSwapError(null);
    setSwappingMealId(meal.id);
    try {
      await swapMeal(activeDay.id, meal.id);
    } catch (err) {
      setSwapError(err.message);
    } finally {
      setSwappingMealId(null);
    }
  };

  const runExport = async (fn) => {
    setExporting(true);
    setExportError(null);
    try {
      await fn(days, user?.name ?? 'Usuario');
    } catch (err) {
      setExportError(err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Tu plan</Text>

        {offline && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={16} color={colors.textMuted} />
            <Text style={styles.offlineBannerText}>
              Sin conexión — mostrando el último plan guardado en tu teléfono.
            </Text>
          </View>
        )}

        {loading && days.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={{ marginBottom: spacing.lg }} />
        ) : days.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.mealItem}>Todavía no tienes un plan.</Text>

            <Pressable style={styles.primaryButton} onPress={handleGenerate} disabled={generating}>
              {generating ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Ionicons name="sparkles-outline" size={18} color="#FFF" />
                  <Text style={styles.primaryButtonText}>Generar mi plan con IA</Text>
                </>
              )}
            </Pressable>
            {generating && <GeneratingPlanLoader />}

            <Pressable style={styles.actionCard} onPress={createTestPlan}>
              <Ionicons name="flask-outline" size={20} color={colors.primary} />
              <Text style={styles.actionText}>Generar plan de prueba (sin IA, gratis)</Text>
            </Pressable>
            {error && <Text style={styles.whyText}>{error.message}</Text>}
          </View>
        ) : (
          <>
            {days.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayTabs}>
                {days.map((day, i) => {
                  const selected = i === selectedDay;
                  return (
                    <Pressable
                      key={day.id}
                      style={[styles.dayTab, selected && styles.dayTabSelected]}
                      onPress={() => setSelectedDay(i)}
                    >
                      <Text style={[styles.dayTabText, selected && styles.dayTabTextSelected]}>
                        {day.dayOfWeek || `Día ${day.dayIndex}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {days.length > 0 && (
              <View style={styles.exportRow}>
                <Pressable style={styles.exportButton} onPress={() => runExport(exportPlanAsPdf)} disabled={exporting}>
                  <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                  <Text style={styles.exportButtonText}>Exportar PDF</Text>
                </Pressable>
                <Pressable style={styles.exportButton} onPress={() => runExport(exportPlanAsExcel)} disabled={exporting}>
                  <Ionicons name="grid-outline" size={16} color={colors.primary} />
                  <Text style={styles.exportButtonText}>Exportar Excel</Text>
                </Pressable>
                <Pressable style={styles.exportButton} onPress={() => setShoppingListOpen(true)}>
                  <Ionicons name="cart-outline" size={16} color={colors.primary} />
                  <Text style={styles.exportButtonText}>Lista de compras</Text>
                </Pressable>
                {exporting && <ActivityIndicator color={colors.primary} size="small" />}
              </View>
            )}
            {exportError && <Text style={styles.whyText}>{exportError}</Text>}

            {activeDay && (
              <Text style={styles.dayMacros}>
                {activeDay.calories} kcal · {activeDay.macros.protein}g prot ·{' '}
                {activeDay.macros.carbs}g carb · {activeDay.macros.fat}g grasa
              </Text>
            )}

            {activeDay?.meals.map((meal) => {
              const isSwapping = swappingMealId === meal.id;
              return (
                <View key={meal.id} style={styles.card}>
                  <Text style={styles.mealName}>{meal.name}</Text>
                  {meal.items.map((item, i) => (
                    <Text key={i} style={styles.mealItem}>• {item}</Text>
                  ))}

                  <View style={styles.mealActionsRow}>
                    <Pressable onPress={() => toggleExplain(meal.id)} style={styles.whyButton}>
                      <Ionicons name="bulb-outline" size={16} color={colors.primary} />
                      <Text style={styles.whyButtonText}>
                        {expandedId === meal.id ? 'Ocultar explicación' : '¿Por qué este alimento?'}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => handleSwapMeal(meal)}
                      style={styles.whyButton}
                      disabled={isSwapping || swappingMealId !== null}
                    >
                      {isSwapping ? (
                        <ActivityIndicator color={colors.primary} size="small" />
                      ) : (
                        <Ionicons name="swap-horizontal-outline" size={16} color={colors.primary} />
                      )}
                      <Text style={styles.whyButtonText}>
                        {isSwapping ? 'Cambiando...' : 'Cambiar esta comida'}
                      </Text>
                    </Pressable>
                  </View>

                  {expandedId === meal.id && <Text style={styles.whyText}>{meal.why}</Text>}
                </View>
              );
            })}
            {swapError && <Text style={styles.whyText}>{swapError}</Text>}

            <Pressable style={styles.actionCard} onPress={handleGenerate} disabled={generating}>
              {generating ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Ionicons name="refresh-outline" size={20} color={colors.primary} />
              )}
              <Text style={styles.actionText}>Generar otra vez el plan de hoy</Text>
            </Pressable>
            {error && <Text style={styles.whyText}>{error.message}</Text>}
          </>
        )}

        <Pressable style={styles.actionCardColumn} onPress={() => setSocialModalOpen(true)}>
          <View style={styles.actionCardRow}>
            <Ionicons name="restaurant-outline" size={20} color={colors.primary} />
            <Text style={styles.actionText}>Tengo una salida con amigos</Text>
          </View>
          <Text style={styles.actionSubtext}>
            Cuéntale a la IA a dónde vas y te ayuda a elegir bien en el momento, sin sentir que rompiste tu plan.
          </Text>
        </Pressable>

        <Pressable style={styles.actionCardColumn} onPress={() => setBudgetModalOpen(true)}>
          <View style={styles.actionCardRow}>
            <Ionicons name="wallet-outline" size={20} color={colors.primary} />
            <Text style={styles.actionText}>Ajustar por presupuesto/disponibilidad</Text>
          </View>
          <Text style={styles.actionSubtext}>
            Dile qué alimentos tienes o cuánto quieres gastar y te sugiere sustituciones sin perder el equilibrio nutricional.
          </Text>
        </Pressable>
      </ScrollView>

      <AdviceModal
        visible={socialModalOpen}
        title="Tengo una salida con amigos"
        explanation="Cuéntanos a dónde vas o qué se te antoja, y te ayudamos a elegir bien en el momento y a ajustar el resto de tu día — para que disfrutes tu salida sin sentir que rompiste tu plan."
        placeholder="Ej. Voy a cenar a un restaurante italiano con mis amigos..."
        apiCall={api.getSocialEventAdvice}
        onClose={() => setSocialModalOpen(false)}
      />
      <AdviceModal
        visible={budgetModalOpen}
        title="Ajustar por presupuesto/disponibilidad"
        explanation="Cuéntanos qué alimentos tienes disponibles esta semana o cuál es tu límite de gasto, y te sugerimos cómo ajustar tu plan sin perder el equilibrio nutricional."
        placeholder="Ej. Solo tengo huevo, frijol y arroz esta semana..."
        apiCall={api.getBudgetAdvice}
        onClose={() => setBudgetModalOpen(false)}
      />
      <ShoppingListModal
        visible={shoppingListOpen}
        days={days}
        onClose={() => setShoppingListOpen(false)}
      />
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
  mealActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  whyButton: {
    flexDirection: 'row',
    alignItems: 'center',
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
  actionCardColumn: {
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  actionCardRow: { flexDirection: 'row', alignItems: 'center' },
  actionSubtext: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginLeft: 28,
    lineHeight: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  primaryButtonText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  dayTabs: { marginBottom: spacing.sm },
  dayTab: {
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
  },
  dayTabSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  dayTabText: { fontSize: 13, fontWeight: '600', color: colors.text },
  dayTabTextSelected: { color: colors.primary },
  exportRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
  },
  exportButtonText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  dayMacros: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.md },
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

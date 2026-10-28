import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme/colors';
import { useUser } from '../context/UserContext';
import { PRIMARY_GOAL_OPTIONS, BUDGET_TIER_OPTIONS, DIET_PHILOSOPHY_OPTIONS } from '../data/onboardingOptions';
import { getReminderPreference, setReminderPreference } from '../utils/notifications';

const REMINDER_HOUR_OPTIONS = [7, 9, 12, 18, 21];

function labelFor(options, value) {
  return options.find((o) => o.value === value)?.label ?? '—';
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <View style={{ marginLeft: spacing.sm }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const { user, loading, error, refresh, startEditingProfile, logout } = useUser();
  const [reminder, setReminder] = useState({ enabled: true, hour: 9 });

  useEffect(() => {
    getReminderPreference().then(setReminder);
  }, []);

  const toggleReminder = async (enabled) => {
    const next = { ...reminder, enabled };
    setReminder(next);
    await setReminderPreference(next);
  };

  const pickReminderHour = async (hour) => {
    const next = { ...reminder, hour };
    setReminder(next);
    await setReminderPreference(next);
  };

  const confirmLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Seguro que quieres salir? Vas a poder crear o entrar a otro perfil.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cerrar sesión', style: 'destructive', onPress: logout },
      ]
    );
  };

  if (loading && !user) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !user) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.rowLabel}>No se pudo cargar tu perfil.</Text>
          <Pressable style={styles.retryButton} onPress={refresh}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.name[0]}</Text>
        </View>
        <Text style={styles.name}>{user.name}</Text>

        <View style={styles.card}>
          <InfoRow icon="flag-outline" label="Objetivo" value={labelFor(PRIMARY_GOAL_OPTIONS, user.goalProfile.primaryGoal)} />
          <InfoRow
            icon="medkit-outline"
            label="Condiciones clínicas"
            value={user.clinicalProfile.pathologies.length > 0 ? String(user.clinicalProfile.pathologies.length) : 'Ninguna declarada'}
          />
          <InfoRow icon="restaurant-outline" label="Filosofía alimentaria" value={labelFor(DIET_PHILOSOPHY_OPTIONS, user.dietaryProfile.dietPhilosophy)} />
          <InfoRow icon="wallet-outline" label="Presupuesto" value={labelFor(BUDGET_TIER_OPTIONS, user.lifestyleProfile.budgetTier)} />
          <InfoRow icon="location-outline" label="País" value={user.lifestyleProfile.region ?? '—'} />
          <InfoRow icon="flame-outline" label="Racha actual" value={`${user.streakDays} días`} />
        </View>

        <View style={[styles.card, styles.settingsCard]}>
          <View style={styles.settingsHeaderRow}>
            <Ionicons name="notifications-outline" size={18} color={colors.primary} />
            <Text style={styles.settingsTitle}>Recordatorio diario</Text>
            <Switch
              value={reminder.enabled}
              onValueChange={toggleReminder}
              trackColor={{ true: colors.primary }}
              style={{ marginLeft: 'auto' }}
            />
          </View>
          {reminder.enabled && (
            <>
              <Text style={styles.settingsSubtitle}>Te avisamos a esta hora para generar tu plan de hoy:</Text>
              <View style={styles.hourRow}>
                {REMINDER_HOUR_OPTIONS.map((hour) => {
                  const selected = reminder.hour === hour;
                  return (
                    <Pressable
                      key={hour}
                      style={[styles.hourChip, selected && styles.hourChipSelected]}
                      onPress={() => pickReminderHour(hour)}
                    >
                      <Text style={[styles.hourChipText, selected && styles.hourChipTextSelected]}>
                        {hour}:00
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </View>

        <Pressable style={styles.editButton} onPress={startEditingProfile}>
          <Ionicons name="create-outline" size={16} color={colors.primary} />
          <Text style={styles.editButtonText}>Editar mi perfil</Text>
        </Pressable>

        <Pressable style={styles.logoutButton} onPress={confirmLogout}>
          <Ionicons name="log-out-outline" size={16} color={colors.danger} />
          <Text style={styles.logoutButtonText}>Cerrar sesión</Text>
        </Pressable>

        <Text style={styles.disclaimer}>
          Esta aplicación es una herramienta de apoyo y no sustituye la consulta con un
          profesional de la salud.
        </Text>

        <Text style={styles.attribution}>
          Datos de productos proporcionados por Open Food Facts (ODbL).
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  retryButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  retryButtonText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  container: { padding: spacing.lg, alignItems: 'center' },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginTop: spacing.md,
  },
  avatarText: { color: '#FFF', fontSize: 28, fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: spacing.sm, marginBottom: spacing.lg },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  rowLabel: { fontSize: 12, color: colors.textMuted },
  rowValue: { fontSize: 14, color: colors.text, fontWeight: '600' },
  settingsCard: { marginTop: spacing.lg },
  settingsHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  settingsTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  settingsSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.sm },
  hourRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hourChip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  hourChipSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  hourChipText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  hourChipTextSelected: { color: colors.primary },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
  },
  editButtonText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
  },
  logoutButtonText: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  disclaimer: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 17,
  },
  attribution: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});

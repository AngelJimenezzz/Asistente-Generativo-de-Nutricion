import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme/colors';
import { mockUser } from '../data/mockData';

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
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{mockUser.name[0]}</Text>
        </View>
        <Text style={styles.name}>{mockUser.name}</Text>

        <View style={styles.card}>
          <InfoRow icon="medkit-outline" label="Condición clínica" value={mockUser.condition} />
          <InfoRow icon="flag-outline" label="Objetivo" value={mockUser.goal} />
          <InfoRow icon="wallet-outline" label="Presupuesto semanal" value={`$${mockUser.weeklyBudget} MXN`} />
          <InfoRow icon="flame-outline" label="Racha actual" value={`${mockUser.streakDays} días`} />
        </View>

        <Text style={styles.disclaimer}>
          Esta aplicación es una herramienta de apoyo y no sustituye la consulta con un
          profesional de la salud.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
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
  disclaimer: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 17,
  },
});

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme/colors';

const POINTS = [
  {
    icon: 'person-outline',
    title: 'Cuéntanos de ti',
    text: 'Tu salud, alergias, gustos, presupuesto y objetivos — un registro de unos minutos, una sola vez.',
  },
  {
    icon: 'sparkles-outline',
    title: 'Tu plan, generado con IA',
    text: 'Cada día, un plan de comidas pensado para tu perfil, con una explicación clínica de por qué se eligió cada alimento.',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Revisado antes de mostrártelo',
    text: 'Antes de llegar a tu pantalla, cada plan pasa por reglas de seguridad que verifican calorías, alergias y tu condición de salud.',
  },
  {
    icon: 'calendar-outline',
    title: 'Un día a la vez',
    text: 'Te vamos a pedir que regreses cada día por tu plan — así la app te acompaña en el camino, no solo una vez a la semana.',
  },
];

export default function WelcomeScreen({ onContinue }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Bienvenido/a 👋</Text>
        <Text style={styles.subtitle}>
          Asistente Generativo de Nutrición de Precisión — antes de registrarte, esto es lo que hace la app:
        </Text>

        {POINTS.map((point) => (
          <View key={point.title} style={styles.pointCard}>
            <View style={styles.iconCircle}>
              <Ionicons name={point.icon} size={22} color={colors.primary} />
            </View>
            <View style={styles.pointTextWrap}>
              <Text style={styles.pointTitle}>{point.title}</Text>
              <Text style={styles.pointText}>{point.text}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.disclaimer}>
          Esta aplicación es una herramienta de apoyo y no sustituye la consulta con un
          profesional de la salud.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.continueButton} onPress={onContinue}>
          <Text style={styles.continueButtonText}>Comenzar registro</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFF" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: spacing.xl },
  title: { fontSize: 26, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  subtitle: { fontSize: 14, color: colors.textMuted, marginBottom: spacing.lg, lineHeight: 20 },
  pointCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  pointTextWrap: { flex: 1 },
  pointTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
  pointText: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  disclaimer: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 17,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
  },
  continueButtonText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});

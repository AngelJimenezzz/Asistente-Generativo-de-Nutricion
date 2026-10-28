import React from 'react';
import { View, Text, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppNavigator from './AppNavigator';
import OnboardingScreen from '../screens/OnboardingScreen';
import { useUser } from '../context/UserContext';
import { colors, spacing } from '../theme/colors';

// Decide qué mostrar primero: cargando, error de conexión, el registro
// (si no hay perfil completo todavía), o la app normal (tabs).
export default function RootGate() {
  const { user, loading, error, needsOnboarding, refresh, submitOnboarding, cancelEditingProfile } = useUser();

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>No se pudo conectar con el servidor.</Text>
          <Text style={styles.errorDetail}>{error.message}</Text>
          <Pressable style={styles.retryButton} onPress={refresh}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (needsOnboarding) {
    return (
      <OnboardingScreen
        existingUser={user}
        onComplete={submitOnboarding}
        onCancel={user?.onboardingComplete ? cancelEditingProfile : undefined}
      />
    );
  }

  return <AppNavigator />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  errorTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: spacing.xs, textAlign: 'center' },
  errorDetail: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  retryButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  retryButtonText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
});

import React, { useState } from 'react';
import {
  Modal, View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme/colors';
import { useUser } from '../context/UserContext';

// Modal genérico para las funciones de "una pregunta, un consejo" (Tengo una
// salida con amigos / Ajustar por presupuesto-disponibilidad). El usuario
// escribe su situación en texto libre y recibe una respuesta de la IA basada
// en su perfil, condición clínica y plan actual.
export default function AdviceModal({ visible, title, placeholder, apiCall, onClose }) {
  const { user } = useUser();
  const [situation, setSituation] = useState('');
  const [advice, setAdvice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reset = () => {
    setSituation('');
    setAdvice(null);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!situation.trim() || !user) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiCall(user.id, situation.trim());
      setAdvice(result.advice);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={handleClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {!advice ? (
              <>
                <TextInput
                  style={styles.input}
                  value={situation}
                  onChangeText={setSituation}
                  placeholder={placeholder}
                  placeholderTextColor={colors.textMuted}
                  multiline
                  editable={!loading}
                />
                <Pressable style={styles.submitButton} onPress={submit} disabled={loading || !situation.trim()}>
                  {loading ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={styles.submitButtonText}>Pedir consejo</Text>
                  )}
                </Pressable>
                {error && <Text style={styles.errorText}>{error}</Text>}
              </>
            ) : (
              <>
                <View style={styles.adviceCard}>
                  <Ionicons name="sparkles-outline" size={18} color={colors.primary} style={{ marginBottom: spacing.xs }} />
                  <Text style={styles.adviceText}>{advice}</Text>
                </View>
                <Pressable style={styles.secondaryButton} onPress={reset}>
                  <Text style={styles.secondaryButtonText}>Preguntar otra cosa</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingTop: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.text, flex: 1, marginRight: spacing.md },
  body: { padding: spacing.lg, paddingTop: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    minHeight: 90,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitButtonText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  errorText: { fontSize: 13, color: colors.danger, marginTop: spacing.sm, textAlign: 'center' },
  adviceCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  adviceText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  secondaryButton: { alignItems: 'center', padding: spacing.md },
  secondaryButtonText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
});

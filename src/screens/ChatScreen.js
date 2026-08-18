import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme/colors';

const INITIAL_MESSAGES = [
  {
    id: '0',
    from: 'assistant',
    text: 'Hola, soy tu asistente de nutrición. Cuéntame cómo te sientes hoy o pregúntame sobre tu plan.',
  },
];

export default function ChatScreen() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState('');

  const send = () => {
    if (!input.trim()) return;
    const userMsg = { id: Date.now().toString(), from: 'user', text: input };

    // TODO: reemplazar por la llamada real a tu endpoint FastAPI
    // (RAG + guardrails + modelo LoRA) cuando el backend esté listo.
    const placeholderReply = {
      id: (Date.now() + 1).toString(),
      from: 'assistant',
      text: '[Respuesta simulada] Cuando el backend esté conectado, aquí verás la recomendación generada, validada y explicada.',
    };

    setMessages((prev) => [...prev, userMsg, placeholderReply]);
    setInput('');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.from === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
              ]}
            >
              <Text style={item.from === 'user' ? styles.bubbleTextUser : styles.bubbleText}>
                {item.text}
              </Text>
            </View>
          )}
        />

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Escribe tu mensaje..."
            placeholderTextColor={colors.textMuted}
          />
          <Pressable style={styles.sendButton} onPress={send}>
            <Ionicons name="send" size={18} color="#FFF" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, paddingBottom: spacing.md },
  bubble: { maxWidth: '80%', borderRadius: 16, padding: spacing.sm, marginBottom: spacing.sm },
  bubbleAssistant: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignSelf: 'flex-start' },
  bubbleUser: { backgroundColor: colors.primary, alignSelf: 'flex-end' },
  bubbleText: { color: colors.text, fontSize: 14, lineHeight: 19 },
  bubbleTextUser: { color: '#FFF', fontSize: 14, lineHeight: 19 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    backgroundColor: colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    marginLeft: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

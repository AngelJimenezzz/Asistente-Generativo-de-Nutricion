import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme/colors';
import { useUser } from '../context/UserContext';
import { api } from '../services/api';

// clientOnly: el saludo es decorativo, no una respuesta real del modelo — si se
// manda al backend como parte del historial, es el primer mensaje de la
// conversación con rol "assistant" (antes de cualquier mensaje "user"), y
// Together.ai rechaza esa forma con 400 Bad Request. Se excluye del payload
// al enviar (ver `send`).
const INITIAL_MESSAGES = [
  {
    id: '0',
    role: 'assistant',
    content: 'Hola, soy tu asistente de nutrición. Cuéntame cómo te sientes hoy o pregúntame sobre tu plan.',
    clientOnly: true,
  },
];

export default function ChatScreen() {
  const { user } = useUser();
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const scrollToBottom = () => {
    // El pequeño retraso deja que el FlatList termine de medir el nuevo
    // contenido antes de pedirle que baje — si no, a veces calcula el final
    // con el tamaño anterior y se queda un poco corto.
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !user) return;

    const userMsg = { id: Date.now().toString(), role: 'user', content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setSending(true);
    scrollToBottom();

    try {
      const { reply } = await api.sendChatMessage(
        user.id,
        history.filter((m) => !m.clientOnly).map(({ role, content }) => ({ role, content }))
      );
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', content: `No se pudo responder: ${err.message}` },
      ]);
    } finally {
      setSending(false);
      scrollToBottom();
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={scrollToBottom}
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
              ]}
            >
              <Text style={item.role === 'user' ? styles.bubbleTextUser : styles.bubbleText}>
                {item.content}
              </Text>
            </View>
          )}
          ListFooterComponent={
            sending ? (
              <View style={[styles.bubble, styles.bubbleAssistant]}>
                <ActivityIndicator color={colors.primary} size="small" />
              </View>
            ) : null
          }
        />

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Escribe tu mensaje..."
            placeholderTextColor={colors.textMuted}
            editable={!sending}
            onSubmitEditing={send}
            accessibilityLabel="Mensaje para el asistente"
          />
          <Pressable
            style={styles.sendButton}
            onPress={send}
            disabled={sending}
            accessibilityRole="button"
            accessibilityLabel="Enviar mensaje"
          >
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

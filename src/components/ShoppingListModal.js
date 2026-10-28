import React from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme/colors';
import { buildShoppingList } from '../utils/shoppingList';

// Lista de compras: consolida los alimentos de todos los días ya generados
// esta semana en una sola lista sin repetidos — no gasta IA, es puro texto
// que ya existe en cada comida.
export default function ShoppingListModal({ visible, days, onClose }) {
  const items = buildShoppingList(days);

  const shareList = async () => {
    try {
      await Share.share({ message: `Lista de compras:\n\n${items.map((i) => `• ${i}`).join('\n')}` });
    } catch {
      // si falla el share nativo, no es grave — el usuario sigue viendo la lista en pantalla
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Lista de compras</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            {items.length === 0 ? (
              <Text style={styles.emptyText}>
                Todavía no tienes alimentos en tu plan para armar una lista.
              </Text>
            ) : (
              items.map((item, i) => (
                <View key={i} style={styles.itemRow}>
                  <Ionicons name="ellipse-outline" size={8} color={colors.primary} />
                  <Text style={styles.itemText}>{item}</Text>
                </View>
              ))
            )}
          </ScrollView>

          {items.length > 0 && (
            <Pressable style={styles.shareButton} onPress={shareList}>
              <Ionicons name="share-outline" size={18} color="#FFF" />
              <Text style={styles.shareButtonText}>Compartir lista</Text>
            </Pressable>
          )}
        </View>
      </View>
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
    paddingBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.lg },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  itemText: { fontSize: 14, color: colors.text, flex: 1 },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  shareButtonText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
});

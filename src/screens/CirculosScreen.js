import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme/colors';
import { mockCircle } from '../data/mockData';

export default function CirculosScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.title}>{mockCircle.name}</Text>

        <View style={styles.challengeCard}>
          <Ionicons name="ribbon-outline" size={20} color={colors.primary} />
          <Text style={styles.challengeText}>{mockCircle.weeklyChallenge}</Text>
        </View>

        <Text style={styles.sectionTitle}>Constancia del grupo</Text>
        {/* Nota de diseño: se muestra racha/constancia, nunca peso ni medidas corporales */}
        <FlatList
          data={mockCircle.members}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.memberRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name[0]}</Text>
              </View>
              <Text style={styles.memberName}>{item.name}</Text>
              <View style={styles.streakPill}>
                <Ionicons name="flame" size={14} color={colors.accent} />
                <Text style={styles.streakPillText}>{item.streak}</Text>
              </View>
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: spacing.lg },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  challengeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  challengeText: { fontSize: 14, color: colors.text, marginLeft: spacing.sm, flex: 1, fontWeight: '600' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textMuted, marginBottom: spacing.sm },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#FFF', fontWeight: '700' },
  memberName: { flex: 1, marginLeft: spacing.sm, fontSize: 14, color: colors.text, fontWeight: '600' },
  streakPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF6EC', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  streakPillText: { marginLeft: 4, fontSize: 12, color: colors.text, fontWeight: '700' },
});

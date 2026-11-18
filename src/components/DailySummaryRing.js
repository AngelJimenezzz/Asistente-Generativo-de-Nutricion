import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, spacing } from '../theme/colors';

const RING_SIZE = 148;
const RING_STROKE = 14;
const RADIUS = (RING_SIZE - RING_STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const MACROS = [
  { key: 'carbs', label: 'Carbohidratos', kcalPerGram: 4, color: colors.primary },
  { key: 'protein', label: 'Proteínas', kcalPerGram: 4, color: colors.accent },
  { key: 'fat', label: 'Grasas', kcalPerGram: 9, color: colors.text },
];

function MacroBar({ label, grams, percent, color }) {
  return (
    <View style={styles.macroRow}>
      <View style={styles.macroLabelRow}>
        <View style={[styles.macroDot, { backgroundColor: color }]} />
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.macroPercent}>{percent}%</Text>
      </View>
      <View style={styles.macroTrack}>
        <View style={[styles.macroFill, { width: `${percent}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.macroGrams}>{grams}g</Text>
    </View>
  );
}

export default function DailySummaryRing({ calories, macros, mealsCount }) {
  const contributions = MACROS.map((m) => ({
    ...m,
    grams: macros[m.key] ?? 0,
    kcal: (macros[m.key] ?? 0) * m.kcalPerGram,
  }));
  const totalKcalFromMacros = contributions.reduce((sum, m) => sum + m.kcal, 0) || 1;

  let offsetSoFar = 0;
  const segments = contributions.map((m) => {
    const fraction = m.kcal / totalKcalFromMacros;
    const segment = { ...m, fraction, offset: offsetSoFar };
    offsetSoFar += fraction;
    return segment;
  });

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.ringWrap}>
          <Svg width={RING_SIZE} height={RING_SIZE}>
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              stroke={colors.border}
              strokeWidth={RING_STROKE}
              fill="none"
            />
            {segments.map((seg) => (
              <Circle
                key={seg.key}
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RADIUS}
                stroke={seg.color}
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={`${seg.fraction * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                strokeDashoffset={-seg.offset * CIRCUMFERENCE}
                fill="none"
                rotation={-90}
                originX={RING_SIZE / 2}
                originY={RING_SIZE / 2}
              />
            ))}
          </Svg>
          <View style={styles.ringCenter} pointerEvents="none">
            <Text style={styles.ringKcal}>{Math.round(calories)}</Text>
            <Text style={styles.ringKcalLabel}>kcal</Text>
          </View>
        </View>

        <View style={styles.ringSideText}>
          <Text style={styles.ringTitle}>Resumen de hoy</Text>
          {mealsCount != null && (
            <Text style={styles.ringSubtitle}>{mealsCount} comida{mealsCount === 1 ? '' : 's'}</Text>
          )}
        </View>
      </View>

      <View style={styles.macrosWrap}>
        {segments.map((seg) => (
          <MacroBar
            key={seg.key}
            label={seg.label}
            grams={seg.grams}
            percent={Math.round(seg.fraction * 100)}
            color={seg.color}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  ringWrap: { width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  ringKcal: { fontSize: 32, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  ringKcalLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: -2 },
  ringSideText: { marginLeft: spacing.md, flex: 1 },
  ringTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  ringSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  macrosWrap: { gap: spacing.sm },
  macroRow: { marginBottom: 2 },
  macroLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  macroDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  macroLabel: { fontSize: 12, color: colors.text, fontWeight: '600', flex: 1 },
  macroPercent: { fontSize: 12, color: colors.textMuted, fontWeight: '700' },
  macroTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  macroFill: { height: '100%', borderRadius: 3 },
  macroGrams: { fontSize: 11, color: colors.textMuted, marginTop: 2, alignSelf: 'flex-end' },
});

import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StepContainer, FieldLabel, MultiSelect, SingleSelect, TextField, Disclaimer } from './components';
import { ALLERGY_OPTIONS, DIET_PHILOSOPHY_OPTIONS } from '../../data/onboardingOptions';
import { api } from '../../services/api';
import { colors, spacing } from '../../theme/colors';

export default function Step4Dietary({ data, update }) {
  const dietary = data.dietaryProfile;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const runSearch = async () => {
    if (query.trim().length < 2) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await api.searchFoods(query.trim());
      setResults(res.products);
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const addDisliked = (product) => {
    const already = dietary.dislikedFoods.some((f) => f.barcode === product.barcode);
    if (already) return;
    update('dietaryProfile.dislikedFoods', [
      ...dietary.dislikedFoods,
      { barcode: product.barcode, name: product.name },
    ]);
  };

  const removeDisliked = (barcode) => {
    update('dietaryProfile.dislikedFoods', dietary.dislikedFoods.filter((f) => f.barcode !== barcode));
  };

  return (
    <StepContainer title="Tu alimentación" subtitle="Esto se respeta siempre: nunca vas a ver estos alimentos en tu plan.">
      <FieldLabel>¿Tienes alergias o intolerancias?</FieldLabel>
      <MultiSelect
        options={ALLERGY_OPTIONS}
        value={dietary.allergies}
        onChange={(v) => update('dietaryProfile.allergies', v)}
      />

      <FieldLabel>¿Sigues alguna filosofía alimentaria?</FieldLabel>
      <SingleSelect
        options={DIET_PHILOSOPHY_OPTIONS}
        value={dietary.dietPhilosophy}
        onChange={(v) => update('dietaryProfile.dietPhilosophy', v)}
      />

      <FieldLabel>Alimentos que no te gustan (opcional)</FieldLabel>
      <View style={styles.searchRow}>
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder="Busca un alimento, ej. brócoli"
        />
      </View>
      <Pressable style={styles.searchButton} onPress={runSearch} disabled={searching}>
        {searching ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.searchButtonText}>Buscar en OpenFoodFacts</Text>}
      </Pressable>
      {searchError && <Text style={styles.errorText}>{searchError}</Text>}

      {results.map((product) => (
        <Pressable key={product.barcode} style={styles.resultRow} onPress={() => addDisliked(product)}>
          <Text style={styles.resultName}>{product.name}</Text>
          <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
        </Pressable>
      ))}

      {dietary.dislikedFoods.length > 0 && (
        <View style={styles.chipRow}>
          {dietary.dislikedFoods.map((f) => (
            <View key={f.barcode ?? f.name} style={styles.chip}>
              <Text style={styles.chipText}>{f.name}</Text>
              <Pressable onPress={() => removeDisliked(f.barcode)}>
                <Ionicons name="close" size={14} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <Disclaimer>
        La búsqueda usa datos reales de Open Food Facts. Recuerda que solo dura ~10
        búsquedas por minuto — si no encuentra nada, espera un momento y vuelve a intentar.
      </Disclaimer>
    </StepContainer>
  );
}

const styles = StyleSheet.create({
  searchRow: { marginBottom: 0 },
  searchButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  searchButtonText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  errorText: { fontSize: 12, color: colors.danger, marginBottom: spacing.sm },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  resultName: { fontSize: 13, color: colors.text, flex: 1, marginRight: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  chipText: { fontSize: 13, color: colors.text, fontWeight: '600' },
});

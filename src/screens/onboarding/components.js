import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme/colors';

export function StepContainer({ title, subtitle, children }) {
  return (
    <View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

export function FieldLabel({ children }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

// Selector de una sola opción — funciona como lista de radio buttons. Tocar
// la opción ya seleccionada la quita (vuelve a null/vacío) en vez de dejarla
// fija — antes no había forma de deshacer una selección por error.
export function SingleSelect({ options, value, onChange }) {
  return (
    <View style={styles.optionList}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            style={[styles.optionRow, selected && styles.optionRowSelected]}
            onPress={() => onChange(selected ? null : opt.value)}
          >
            <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{opt.label}</Text>
            {selected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
          </Pressable>
        );
      })}
    </View>
  );
}

// Selector de varias opciones — cada una se puede prender/apagar.
export function MultiSelect({ options, value, onChange }) {
  const toggle = (optValue) => {
    if (value.includes(optValue)) {
      onChange(value.filter((v) => v !== optValue));
    } else {
      onChange([...value, optValue]);
    }
  };

  return (
    <View style={styles.optionList}>
      {options.map((opt) => {
        const selected = value.includes(opt.value);
        return (
          <Pressable
            key={opt.value}
            style={[styles.optionRow, selected && styles.optionRowSelected]}
            onPress={() => toggle(opt.value)}
          >
            <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{opt.label}</Text>
            <Ionicons
              name={selected ? 'checkbox' : 'square-outline'}
              size={20}
              color={selected ? colors.primary : colors.textMuted}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

export function TextField({ value, onChangeText, placeholder, keyboardType, multiline }) {
  return (
    <TextInput
      style={[styles.textField, multiline && styles.textFieldMultiline]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      keyboardType={keyboardType}
      multiline={multiline}
    />
  );
}

// Campo para agregar varios textos sueltos (ej. medicamentos) como "chips".
export function ChipListInput({ value, onChange, placeholder }) {
  const [draft, setDraft] = React.useState('');

  const add = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onChange([...value, trimmed]);
    setDraft('');
  };

  const remove = (index) => onChange(value.filter((_, i) => i !== index));

  return (
    <View>
      <View style={styles.chipInputRow}>
        <TextInput
          style={[styles.textField, { flex: 1, marginBottom: 0 }]}
          value={draft}
          onChangeText={setDraft}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          onSubmitEditing={add}
        />
        <Pressable style={styles.addButton} onPress={add}>
          <Ionicons name="add" size={20} color="#FFF" />
        </Pressable>
      </View>
      <View style={styles.chipRow}>
        {value.map((item, i) => (
          <View key={`${item}-${i}`} style={styles.chip}>
            <Text style={styles.chipText}>{item}</Text>
            <Pressable onPress={() => remove(i)}>
              <Ionicons name="close" size={14} color={colors.textMuted} />
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

export function Disclaimer({ children }) {
  return (
    <View style={styles.disclaimerBox}>
      <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
      <Text style={styles.disclaimerText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  subtitle: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 18 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  optionList: { gap: spacing.sm },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  optionRowSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  optionLabel: { fontSize: 14, color: colors.text },
  optionLabelSelected: { fontWeight: '700' },
  textField: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  textFieldMultiline: { minHeight: 90, textAlignVertical: 'top' },
  chipInputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  addButton: {
    backgroundColor: colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  disclaimerBox: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.sm,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  disclaimerText: { flex: 1, fontSize: 12, color: colors.textMuted, lineHeight: 16 },
});

import React from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme/colors';

const SECTIONS = [
  {
    title: 'Qué es esta app',
    body:
      'Este es un proyecto de tesis de Ingeniería de Software (Universidad de Colima), no un ' +
      'servicio comercial. La demo pública existe para mostrar cómo funciona el prototipo — no ' +
      'está pensada para uso clínico real.',
  },
  {
    title: 'Qué datos se guardan',
    body:
      'Al registrarte, se guarda el perfil que capturas (edad, condiciones de salud declaradas, ' +
      'alergias, objetivos, presupuesto, etc.) y los planes que generes. No se pide correo, ' +
      'contraseña ni ningún dato que te identifique directamente — tu perfil se asocia solo a un ' +
      'identificador aleatorio guardado en tu propio dispositivo.',
  },
  {
    title: 'Recomendación para la demo pública',
    body:
      'Si estás probando esta versión de demostración (no tu propio despliegue), usa datos de ' +
      'ejemplo en vez de tu información real de salud — es una base de datos compartida de un ' +
      'proyecto académico, no un expediente clínico.',
  },
  {
    title: 'Con quién se comparte información',
    body:
      'Para generar un plan, tu perfil (sin nombre) se envía a Together.ai, el proveedor del ' +
      'modelo de lenguaje usado para la generación. La búsqueda de alimentos usa la API pública ' +
      'de Open Food Facts. Ningún dato se vende ni se comparte con nadie más.',
  },
  {
    title: 'No sustituye a un profesional de la salud',
    body:
      'Nada de lo que genera esta app — planes, consejos del chat, sugerencias de sustitución — ' +
      'reemplaza una consulta con un nutriólogo o médico. Ante cualquier duda clínica real, ' +
      'consulta a un profesional.',
  },
];

export default function PrivacyModal({ visible, onClose }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Aviso de privacidad</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cerrar">
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            {SECTIONS.map((section) => (
              <View key={section.title} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionBody}>{section.body}</Text>
              </View>
            ))}
            <Text style={styles.footer}>
              Autor: Angel Arafat Jiménez Sandoval — Facultad de Telemática, Universidad de Colima.
            </Text>
          </ScrollView>
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
    maxHeight: '85%',
    paddingTop: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  section: { marginBottom: spacing.md },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 },
  sectionBody: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  footer: { fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
});

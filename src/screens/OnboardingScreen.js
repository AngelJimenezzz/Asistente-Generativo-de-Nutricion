import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme/colors';

import Step1Basics from './onboarding/Step1Basics';
import Step2Clinical from './onboarding/Step2Clinical';
import Step3Goal from './onboarding/Step3Goal';
import Step4Dietary from './onboarding/Step4Dietary';
import Step5Lifestyle from './onboarding/Step5Lifestyle';
import Step6Flexibility from './onboarding/Step6Flexibility';
import Step7Review from './onboarding/Step7Review';

const STEPS = [Step1Basics, Step2Clinical, Step3Goal, Step4Dietary, Step5Lifestyle, Step6Flexibility, Step7Review];

function buildInitialFormData(existingUser) {
  const defaults = {
    name: '',
    anthropometrics: { age: null, biologicalSex: null, heightCm: null, weightKg: null },
    activityLevel: { workActivity: null, exerciseDaysPerWeek: null, exerciseType: '' },
    goalProfile: { primaryGoal: null, progressSpeed: null },
    clinicalProfile: { pathologies: [], digestiveConditions: [], currentMedications: [], symptomsNotes: '' },
    dietaryProfile: { allergies: [], dietPhilosophy: null, dislikedFoods: [] },
    lifestyleProfile: { budgetTier: null, kitchenEquipment: [], cookingTime: null, mealsPerDay: null, region: null },
    flexibilityProfile: { strictness: null, flavorPreference: null },
  };

  if (!existingUser) return defaults;

  return {
    name: existingUser.name ?? defaults.name,
    anthropometrics: { ...defaults.anthropometrics, ...existingUser.anthropometrics },
    activityLevel: { ...defaults.activityLevel, ...existingUser.activityLevel },
    goalProfile: { ...defaults.goalProfile, ...existingUser.goalProfile },
    clinicalProfile: { ...defaults.clinicalProfile, ...existingUser.clinicalProfile },
    dietaryProfile: { ...defaults.dietaryProfile, ...existingUser.dietaryProfile },
    lifestyleProfile: { ...defaults.lifestyleProfile, ...existingUser.lifestyleProfile },
    flexibilityProfile: { ...defaults.flexibilityProfile, ...existingUser.flexibilityProfile },
  };
}

function setPath(obj, path, value) {
  const keys = path.split('.');
  if (keys.length === 1) {
    return { ...obj, [keys[0]]: value };
  }
  const [group, field] = keys;
  return { ...obj, [group]: { ...obj[group], [field]: value } };
}

export default function OnboardingScreen({ existingUser, onComplete, onCancel }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [data, setData] = useState(() => buildInitialFormData(existingUser));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const StepComponent = STEPS[stepIndex];
  const isFirstStep = stepIndex === 0;
  const isReviewStep = stepIndex === STEPS.length - 1;

  const update = (path, value) => setData((prev) => setPath(prev, path, value));

  const goNext = () => {
    if (isFirstStep && !data.name.trim()) return; // el nombre es lo único obligatorio para avanzar
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };

  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0));

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onComplete(data);
    } catch (err) {
      const violationText = err.violations?.map((v) => `• ${v.message}`).join('\n');
      setSubmitError(violationText ? `${err.message}\n${violationText}` : err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.headerRow}>
          <View style={styles.progressRow}>
            {STEPS.map((_, i) => (
              <View key={i} style={[styles.dot, i <= stepIndex && styles.dotActive]} />
            ))}
          </View>
          {onCancel && (
            <Pressable style={styles.cancelButton} onPress={onCancel}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          )}
        </View>

        <ScrollView contentContainerStyle={styles.container}>
          {isReviewStep ? (
            <Step7Review data={data} onSubmit={handleSubmit} submitting={submitting} submitError={submitError} />
          ) : (
            <StepComponent data={data} update={update} />
          )}
        </ScrollView>

        <View style={styles.navRow}>
          {!isFirstStep && (
            <Pressable style={styles.backButton} onPress={goBack} disabled={submitting}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>
          )}
          {!isReviewStep && (
            <Pressable style={styles.nextButton} onPress={goNext}>
              <Text style={styles.nextButtonText}>Siguiente</Text>
              <Ionicons name="chevron-forward" size={18} color="#FFF" />
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: spacing.sm },
  cancelButton: { position: 'absolute', right: spacing.lg, padding: 4 },
  progressRow: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary },
  container: { padding: spacing.lg, paddingBottom: spacing.xl },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
  },
  nextButtonText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
});

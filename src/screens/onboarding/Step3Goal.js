import React from 'react';
import { StepContainer, FieldLabel, SingleSelect, Disclaimer } from './components';
import { PRIMARY_GOAL_OPTIONS, PROGRESS_SPEED_OPTIONS } from '../../data/onboardingOptions';

// Debe coincidir con PATHOLOGY_RULES en backend/app/guardrails/rules.py —
// son las condiciones que bloquean la velocidad de progreso "agresivo".
const PATHOLOGIES_THAT_BLOCK_AGGRESSIVE = [
  'diabetes_tipo_1',
  'diabetes_tipo_2',
  'resistencia_insulina',
  'enfermedad_renal',
];

export default function Step3Goal({ data, update }) {
  const pathologies = data.clinicalProfile.pathologies;
  const isAggressiveBlocked = pathologies.some((p) => PATHOLOGIES_THAT_BLOCK_AGGRESSIVE.includes(p));

  const speedOptions = isAggressiveBlocked
    ? PROGRESS_SPEED_OPTIONS.filter((opt) => opt.value !== 'agresivo')
    : PROGRESS_SPEED_OPTIONS;

  return (
    <StepContainer title="Tu objetivo" subtitle="¿Qué quieres lograr con tu plan?">
      <FieldLabel>Objetivo principal</FieldLabel>
      <SingleSelect
        options={PRIMARY_GOAL_OPTIONS}
        value={data.goalProfile.primaryGoal}
        onChange={(v) => update('goalProfile.primaryGoal', v)}
      />

      <FieldLabel>Velocidad de progreso</FieldLabel>
      <SingleSelect
        options={speedOptions}
        value={data.goalProfile.progressSpeed}
        onChange={(v) => update('goalProfile.progressSpeed', v)}
      />

      {isAggressiveBlocked && (
        <Disclaimer>
          Como declaraste una condición clínica, la opción "Agresivo / rápido" no está
          disponible por seguridad. Tu plan usará un ritmo más cuidadoso.
        </Disclaimer>
      )}
    </StepContainer>
  );
}

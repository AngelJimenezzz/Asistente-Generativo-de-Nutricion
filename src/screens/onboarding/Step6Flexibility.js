import React from 'react';
import { StepContainer, FieldLabel, SingleSelect, Disclaimer } from './components';
import { STRICTNESS_OPTIONS, FLAVOR_PREFERENCE_OPTIONS } from '../../data/onboardingOptions';

export default function Step6Flexibility({ data, update }) {
  const flex = data.flexibilityProfile;

  return (
    <StepContainer
      title="Flexibilidad"
      subtitle="Un plan demasiado estricto es más fácil de abandonar. Esto ayuda a encontrar tu punto justo."
    >
      <FieldLabel>¿Qué tan estricto quieres que sea tu plan?</FieldLabel>
      <SingleSelect
        options={STRICTNESS_OPTIONS}
        value={flex.strictness}
        onChange={(v) => update('flexibilityProfile.strictness', v)}
      />

      <FieldLabel>Para tus "gustitos", ¿qué prefieres normalmente?</FieldLabel>
      <SingleSelect
        options={FLAVOR_PREFERENCE_OPTIONS}
        value={flex.flavorPreference}
        onChange={(v) => update('flexibilityProfile.flavorPreference', v)}
      />

      <Disclaimer>
        Por ahora esto solo se guarda como preferencia. Sugerir antojos concretos
        adaptados ("3 tacos al pastor", "un elote") y negociarlos por chat son
        funciones que dependen del motor de IA (Fase 3), todavía no implementado.
      </Disclaimer>
    </StepContainer>
  );
}

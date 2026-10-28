import React from 'react';
import { StepContainer, FieldLabel, MultiSelect, ChipListInput, TextField, Disclaimer } from './components';
import { PATHOLOGY_OPTIONS, DIGESTIVE_CONDITION_OPTIONS } from '../../data/onboardingOptions';

export default function Step2Clinical({ data, update }) {
  const clinical = data.clinicalProfile;

  return (
    <StepContainer
      title="Tu salud"
      subtitle="Esta información ayuda a que tu plan sea seguro para tu condición. No sustituye la valoración de un profesional de la salud."
    >
      <FieldLabel>¿Tienes alguna de estas condiciones?</FieldLabel>
      <MultiSelect
        options={PATHOLOGY_OPTIONS}
        value={clinical.pathologies}
        onChange={(v) => update('clinicalProfile.pathologies', v)}
      />

      <FieldLabel>¿Tienes algún trastorno digestivo?</FieldLabel>
      <MultiSelect
        options={DIGESTIVE_CONDITION_OPTIONS}
        value={clinical.digestiveConditions}
        onChange={(v) => update('clinicalProfile.digestiveConditions', v)}
      />

      <FieldLabel>Medicamentos que tomas actualmente (opcional)</FieldLabel>
      <ChipListInput
        value={clinical.currentMedications}
        onChange={(v) => update('clinicalProfile.currentMedications', v)}
        placeholder="Ej. Metformina"
      />
      <Disclaimer>
        Esto no sustituye la revisión de tu médico o farmacéutico. Por ahora solo se
        guarda como información de referencia — todavía no se usa para ajustar
        automáticamente tu plan.
      </Disclaimer>

      <FieldLabel>¿Algo más que quieras contarnos? (opcional)</FieldLabel>
      <TextField
        value={clinical.symptomsNotes ?? ''}
        onChangeText={(v) => update('clinicalProfile.symptomsNotes', v)}
        placeholder="Ej. Me inflamo por las tardes, tengo gastritis nerviosa..."
        multiline
      />
      <Disclaimer>
        Este texto se guarda como referencia para ti y para un futuro profesional
        supervisor. Por ahora ningún sistema automático lo interpreta para cambiar tu
        dieta — eso requiere supervisión clínica real.
      </Disclaimer>
    </StepContainer>
  );
}

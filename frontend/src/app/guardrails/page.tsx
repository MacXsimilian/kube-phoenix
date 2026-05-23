'use client'

import PageHeader from '@/components/shared/PageHeader'
import GuardrailsForm from '@/components/guardrails/GuardrailsForm'

export default function GuardrailsPage() {
  return (
    <>
      <PageHeader
        title="Guardrails"
        subtitle="Configure which namespaces and nodes are always protected from scaling or draining."
      />
      <GuardrailsForm />
    </>
  );
}

'use client'

import Typography from '@mui/material/Typography'
import GuardrailsForm from '@/components/guardrails/GuardrailsForm'

export default function GuardrailsPage() {
  return (
    <>
      <Typography variant="h5" fontWeight={700} mb={1}>
        Guardrails
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Configure which namespaces and nodes are always protected from scaling or draining.
      </Typography>
      <GuardrailsForm />
    </>
  )
}

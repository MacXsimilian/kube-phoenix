'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { triggerPolicySleep, triggerPolicyWake } from '@/lib/api'
import type { SnackMessage } from '@/lib/types'

/**
 * Encapsulates sleep/wake trigger mutations for a policy,
 * including query invalidation and navigation on success.
 */
export function usePolicyTriggers(
  policyId: number,
  onNotify?: (msg: string, severity: SnackMessage['severity']) => void,
) {
  const queryClient = useQueryClient()
  const router = useRouter()

  function onSuccess({ executionId }: { executionId: number }) {
    queryClient.invalidateQueries({ queryKey: ['policies'] })
    queryClient.invalidateQueries({ queryKey: ['policy', policyId] })
    queryClient.invalidateQueries({ queryKey: ['policy-executions'] })
    queryClient.invalidateQueries({ queryKey: ['policy-executions', policyId] })
    router.push(`/policies/detail/?id=${policyId}&exec=${executionId}`)
  }

  function onError(err: unknown, fallback: string) {
    onNotify?.(err instanceof Error ? err.message : fallback, 'error')
  }

  const sleepMut = useMutation({
    mutationFn: () => triggerPolicySleep(policyId),
    onSuccess,
    onError: (err: unknown) => onError(err, 'Trigger sleep failed'),
  })

  const wakeMut = useMutation({
    mutationFn: () => triggerPolicyWake(policyId),
    onSuccess,
    onError: (err: unknown) => onError(err, 'Trigger wake failed'),
  })

  return {
    sleepMut,
    wakeMut,
    isBusy: sleepMut.isPending || wakeMut.isPending,
  }
}

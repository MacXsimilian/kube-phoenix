'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { useRouter } from 'next/navigation'
import { triggerPolicySleep, triggerPolicyWake } from '@/lib/api'
import { formatError } from '@/lib/formatters'
import type { SnackMessage } from '@/lib/types'

/**
 * Encapsulates sleep/wake trigger mutations for a policy,
 * including query invalidation and navigation on success.
 *
 * Pass `onSuccessOverride` to replace the default navigation behaviour
 * (e.g. to invalidate extra query keys or navigate to a different page).
 */
export function usePolicyTriggers(
  policyId: number,
  onNotify?: (msg: string, severity: SnackMessage['severity']) => void,
  onSuccessOverride?: (result: { executionId: number }) => void,
) {
  const queryClient = useQueryClient()
  const router = useRouter()

  function onSuccess(result: { executionId: number }) {
    queryClient.invalidateQueries({ queryKey: queryKeys.policies() })
    queryClient.invalidateQueries({ queryKey: queryKeys.policy(policyId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.policyExecutions() })
    queryClient.invalidateQueries({ queryKey: queryKeys.policyExecutions(policyId) })
    if (onSuccessOverride) {
      onSuccessOverride(result)
    } else {
      router.push(`/policies/detail/?id=${policyId}&exec=${result.executionId}`)
    }
  }

  function onError(err: unknown) {
    onNotify?.(formatError(err), 'error')
  }

  const sleepMut = useMutation({
    mutationFn: (mode?: 'plan' | 'apply') => triggerPolicySleep(policyId, mode),
    onSuccess,
    onError: (err: unknown) => onError(err),
  })

  const wakeMut = useMutation({
    mutationFn: (mode?: 'plan' | 'apply') => triggerPolicyWake(policyId, mode),
    onSuccess,
    onError: (err: unknown) => onError(err),
  })

  return {
    sleepMut,
    wakeMut,
    isBusy: sleepMut.isPending || wakeMut.isPending,
  }
}

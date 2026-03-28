import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@/lib/types'

/**
 * Handles the permission-guard redirect side effect.
 * Returns true if the page should render, false if it should return null.
 */
export function usePermissionGuard(user: User | null, hasPermission: boolean): boolean {
  const router = useRouter()

  useEffect(() => {
    if (user && !hasPermission) router.replace('/overview')
  }, [user, hasPermission, router])

  return !(user && !hasPermission)
}

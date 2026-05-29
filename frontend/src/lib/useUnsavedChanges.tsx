'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmDialog from '@/components/common/ConfirmDialog'

// ── Context ──────────────────────────────────────────────────────────────────

interface UnsavedChangesContextValue {
  setDirty: (dirty: boolean) => void
  isDirty: boolean
}

const UnsavedChangesContext = createContext<UnsavedChangesContextValue>({ setDirty: () => {}, isDirty: false })

export function useUnsavedChanges() {
  return useContext(UnsavedChangesContext)
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const [dirty, setDirty] = useState(false)
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const router = useRouter()
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty

  // Browser tab close / refresh
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  // Intercept internal link clicks app-wide using capture phase so we can
  // prevent Next.js <Link> navigations before they fire. This is necessary
  // because the sidebar uses <Link> directly and there is no router-level
  // navigation guard in Next.js App Router.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!dirtyRef.current) return
      const anchor = (e.target as HTMLElement).closest('a[href]')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (
        !href ||
        href.startsWith('http') ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('javascript:')
      )
        return
      e.preventDefault()
      e.stopPropagation()
      setPendingHref(href)
    }
    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [])

  const handleDiscard = useCallback(() => {
    const href = pendingHref
    setPendingHref(null)
    setDirty(false)
    if (href) router.push(href)
  }, [pendingHref, router])

  const handleCancel = useCallback(() => {
    setPendingHref(null)
  }, [])

  const value = useMemo(() => ({ setDirty, isDirty: dirty }), [setDirty, dirty])

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={pendingHref !== null}
        title="Unsaved changes"
        message="You have unsaved changes that will be lost. Do you want to leave this page?"
        confirmLabel="Leave without saving"
        confirmColor="warning"
        onConfirm={handleDiscard}
        onClose={handleCancel}
      />
    </UnsavedChangesContext.Provider>
  )
}

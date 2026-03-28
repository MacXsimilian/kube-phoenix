import { useState, useCallback } from 'react'

interface Notification {
  message: string
  severity: 'success' | 'error' | 'warning' | 'info'
}

export function useNotification() {
  const [notification, setNotification] = useState<Notification | null>(null)

  const notify = useCallback((message: string, severity: Notification['severity'] = 'success') => {
    setNotification({ message, severity })
  }, [])

  const clear = useCallback(() => setNotification(null), [])

  return { notification, notify, clear }
}

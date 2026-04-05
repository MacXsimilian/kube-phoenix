'use client'

import { ObservabilityStreamProvider } from '@/lib/ObservabilityStreamContext'

export default function ObservabilityLayout({ children }: { children: React.ReactNode }) {
  return <ObservabilityStreamProvider>{children}</ObservabilityStreamProvider>
}

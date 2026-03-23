import { QueryClient } from '@tanstack/react-query'
import { DEFAULT_STALE_TIME_MS } from './constants'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: DEFAULT_STALE_TIME_MS,
      retry: 1,
    },
  },
})

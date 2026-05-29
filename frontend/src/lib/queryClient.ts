import { QueryClient } from '@tanstack/react-query'
import { DEFAULT_STALE_TIME_MS } from './constants'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: DEFAULT_STALE_TIME_MS,
      retry: 1,
      // Most queries already poll on intervals or arrive via SSE — a refetch
      // burst on every Cmd-Tab is just noise. Opt back in per-query if needed.
      refetchOnWindowFocus: false,
    },
  },
})

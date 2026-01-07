import { createTRPCReact } from '@trpc/react-query'
import { httpBatchLink } from '@trpc/client'
import type { AppRouter } from '../../../backend/src/trpc/router'
import { supabase } from './auth'

export const trpc = createTRPCReact<AppRouter>()

export function getTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/trpc`,
        async headers() {
          const { data: { session } } = await supabase.auth.getSession()
          return {
            authorization: session?.access_token
              ? `Bearer ${session.access_token}`
              : '',
          }
        },
      }),
    ],
  })
}

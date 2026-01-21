import { createTRPCReact } from '@trpc/react-query'
import { httpBatchLink } from '@trpc/client'
import type { AppRouter } from '../../../backend/src/trpc/router'
import { getAuthToken } from './auth'

export const trpc = createTRPCReact<AppRouter>()

export function getTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/trpc`,
        headers() {
          const token = getAuthToken()
          return {
            authorization: token ? `Bearer ${token}` : '',
          }
        },
      }),
    ],
  })
}

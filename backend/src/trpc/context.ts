import type { CreateExpressContextOptions } from '@trpc/server/adapters/express'
import { prisma } from '../lib/prisma.js'
import { verifyToken } from '../lib/auth.js'

export async function createContext({ req, res }: CreateExpressContextOptions) {
  // Get token from Authorization header
  const authHeader = req.headers.authorization
  let user = null

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    user = await verifyToken(token)
  }

  return {
    req,
    res,
    prisma,
    user,
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>

import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'
import type { Context } from './context.js'

const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure
export const middleware = t.middleware

// Auth middleware
const isAuthed = middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  })
})

export const protectedProcedure = t.procedure.use(isAuthed)

// Role-based middleware factory
const hasRole = (...roles: string[]) =>
  middleware(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' })
    }
    if (!roles.includes(ctx.user.role)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Insufficient permissions' })
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    })
  })

// Routers for each module will be added here
const authRouter = router({
  me: protectedProcedure.query(({ ctx }) => {
    return ctx.user
  }),
})

const projectRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    // TODO: Implement project list with role-based filtering
    return []
  }),
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // TODO: Implement get project by ID
      return null
    }),
})

const lotRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // TODO: Implement lot list
      return []
    }),
})

// Main app router
export const appRouter = router({
  auth: authRouter,
  project: projectRouter,
  lot: lotRouter,
  // Additional routers will be added here:
  // itp: itpRouter,
  // holdPoint: holdPointRouter,
  // testResult: testResultRouter,
  // ncr: ncrRouter,
  // diary: diaryRouter,
  // claim: claimRouter,
  // document: documentRouter,
  // subcontractor: subcontractorRouter,
})

export type AppRouter = typeof appRouter

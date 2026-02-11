import type { Request, Response, NextFunction } from 'express'

/**
 * Wraps an async Express route handler so rejected promises
 * are forwarded to the global error handler via next(error).
 *
 * Usage:
 *   router.get('/', requireAuth, asyncHandler(async (req, res) => { ... }))
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next)
  }
}

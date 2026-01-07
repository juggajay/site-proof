import type { Request, Response, NextFunction } from 'express'

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now()

  res.on('finish', () => {
    const duration = Date.now() - start
    const logLevel = res.statusCode >= 400 ? 'error' : 'info'

    console[logLevel === 'error' ? 'error' : 'log'](
      `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`
    )
  })

  next()
}

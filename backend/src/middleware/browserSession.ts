import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../lib/AppError.js';

export function requireBrowserSession(req: Request, action: string): void {
  if (req.apiKey) {
    throw AppError.forbidden(`${action} requires an authenticated browser session`);
  }
}

export function requireBrowserSessionMiddleware(action: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      requireBrowserSession(req, action);
      next();
    } catch (error) {
      next(error);
    }
  };
}

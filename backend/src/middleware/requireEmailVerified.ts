import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/AppError.js';

/**
 * Gate sensitive actions (creating a company, sending invites) behind a verified
 * email address. `req.user.emailVerified` is read fresh from the DB per request
 * (see verifyToken), so it reflects verification that happened after sign-in.
 * Login and read access are deliberately NOT gated (M1).
 *
 * Must run after requireAuth so req.user is populated.
 */
export function requireEmailVerified(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user?.emailVerified) {
    next(
      AppError.forbidden(
        'Please verify your email address before performing this action. Check your inbox for the verification link.',
      ),
    );
    return;
  }
  next();
}

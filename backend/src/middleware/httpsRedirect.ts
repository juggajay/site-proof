import type { RequestHandler } from 'express';
import { buildHttpsRedirectUrl } from '../lib/runtimeConfig.js';

export const httpsRedirect: RequestHandler = (req, res, next) => {
  if (req.protocol !== 'https') {
    return res.redirect(301, buildHttpsRedirectUrl(req.originalUrl || req.url));
  }

  next();
};

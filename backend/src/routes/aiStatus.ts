import { Router } from 'express';

import { requireAuth } from '../middleware/authMiddleware.js';
import { isAnthropicConfigured } from './testResults/certificateExtraction.js';

const router = Router();

/**
 * GET /api/ai/status — whether AI extraction is usable on this server.
 *
 * The frontend uses this to disable "Import from setout sheet" (and skip
 * chainage/AI hints) when no Anthropic key is configured, so a user does not
 * pick a file and only then hit a 503. Auth-gated but exposes nothing beyond the
 * single boolean.
 */
router.get('/status', requireAuth, (_req, res) => {
  res.json({ aiConfigured: isAnthropicConfigured() });
});

export { router as aiStatusRouter };

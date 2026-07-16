// W2-PR3: AI ranking of a Tier-B lot→ITP template shortlist.
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { matchTemplatesForProject } from '../../lib/itpMatcher.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { chatRateLimiter } from '../../middleware/rateLimiter.js';
import { requireProjectTemplateAccess } from './templateAccess.js';
import { MAX_TEMPLATE_ID_LENGTH } from './templateValidation.js';
import { rankTierBCandidates } from './templateRankService.js';

export const templateRankRouter = Router();

const rankBodySchema = z.object({
  projectId: z.string().trim().min(1, 'projectId is required').max(MAX_TEMPLATE_ID_LENGTH),
  activity: z.string().trim().min(1, 'activity is required').max(MAX_TEMPLATE_ID_LENGTH),
  lotContext: z.string().trim().max(1000).optional(),
});

// AI-ranked suggested templates for a Tier-B lot activity. The server re-runs
// the deterministic matcher (never trusting a client-sent candidate list) and
// only calls the model when the result is Tier B; Tier A/C return the match
// result unchanged (no AI call). Mounted before templatesRouter so
// `/templates/rank` resolves ahead of `/templates/:id`. chatRateLimiter is the
// conventional per-user AI limiter (same one the Clancy chat endpoint uses).
templateRankRouter.post(
  '/templates/rank',
  requireAuth,
  chatRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const parsed = rankBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.fromZodError(parsed.error);
    }
    const { projectId, activity, lotContext } = parsed.data;

    const { project } = await requireProjectTemplateAccess(projectId, user);

    const match = await matchTemplatesForProject({ projectId, activity });
    if (match.tier !== 'B') {
      res.json(match);
      return;
    }

    // Throws 503 (unconfigured) or 502 (call/parse failure); both propagate so
    // the frontend falls back to the deterministic order silently.
    const { candidates, reasons, note } = await rankTierBCandidates({
      projectName: project.name,
      specificationSet: project.specificationSet,
      activityValue: activity,
      lotContext,
      candidates: match.candidates,
    });

    res.json({ ...match, candidates, ranking: { reasons, note } });
  }),
);

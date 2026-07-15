// W2-PR2: deterministic lot→ITP template match endpoint.
import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { matchTemplatesForProject } from '../../lib/itpMatcher.js';
import { requireProjectTemplateAccess } from './templateAccess.js';
import { parseRequiredTemplateQueryString } from './templateValidation.js';

export const templateMatchRouter = Router();

// Suggested ITP templates for a lot's activity, scoped to the project. Mounted
// before templatesRouter so `/templates/match` resolves ahead of `/templates/:id`.
templateMatchRouter.get(
  '/templates/match',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const projectId = parseRequiredTemplateQueryString(req.query.projectId, 'projectId');
    const activity = typeof req.query.activity === 'string' ? req.query.activity : undefined;

    await requireProjectTemplateAccess(projectId, user);

    const result = await matchTemplatesForProject({ projectId, activity });
    res.json(result);
  }),
);

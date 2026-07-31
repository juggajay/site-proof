// Feature #592 trigger - ITP instance snapshot from template
// Feature #175 - Auto-notification before witness point
import { Router } from 'express';
import { templateCompareRouter } from './templateCompare.js';
import { templateMatchRouter } from './templateMatch.js';
import { templateRankRouter } from './templateRank.js';
import { templatesRouter } from './templates.js';
import { instancesRouter } from './instances.js';
import { completionsRouter } from './completions.js';

const itpRouter = Router();

// Mount all sub-routers - routes are defined with full paths in each module.
// templateMatchRouter / templateRankRouter must precede templatesRouter so the
// literal `/templates/match` and `/templates/rank` paths are matched before
// `/templates/:id`.
itpRouter.use(templateMatchRouter);
itpRouter.use(templateRankRouter);
// Wave G G2: `/templates/:id/compare` precedes `/templates/:id` for the same
// reason the two above do — mount order, not path shape, is what decides.
// 404s entirely while ITP_PROVENANCE_ENABLED is unset.
itpRouter.use(templateCompareRouter);
itpRouter.use(templatesRouter);
itpRouter.use(instancesRouter);
itpRouter.use(completionsRouter);

export { itpRouter };

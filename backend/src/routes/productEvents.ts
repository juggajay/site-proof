// POST /api/product-events — privacy-conscious UX/product telemetry ingestion.
//
// Accepts a small batch (max 20) of catalog-registered events. requireAuth
// runs route-wide; userId/companyId are derived from the session, NEVER from
// the body. Unknown event names and non-whitelisted metadata are dropped, not
// stored. Best-effort persistence — this endpoint never fails a user flow.

import { Router } from 'express';
import { z } from 'zod';

import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { parseProductEventItem, writeProductEvents } from '../lib/productEvents.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { productEventsRateLimiter } from '../middleware/rateLimiter.js';

const eventItemSchema = z.object({
  event: z.string().min(1).max(80),
  step: z.string().trim().min(1).max(80).optional(),
  metadata: z.record(z.unknown()).optional(),
  clientTs: z.string().datetime().optional(),
});

const batchSchema = z.object({
  events: z.array(eventItemSchema).min(1).max(20),
});

const productEventsRouter = Router();

// Route-wide auth: gives productEventsRateLimiter a req.user to key on and
// satisfies route auth coverage.
productEventsRouter.use(requireAuth);

productEventsRouter.post(
  '/',
  productEventsRateLimiter,
  asyncHandler(async (req, res) => {
    const parsed = batchSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.fromZodError(parsed.error);
    }

    const user = req.user!;
    const identity = { userId: user.id, companyId: user.companyId ?? null };

    // Drop unknown events / bad metadata silently: telemetry is fire-and-forget,
    // and a stray unrecognised name should not 4xx the client's whole batch.
    const rows = parsed.data.events
      .map((item) => parseProductEventItem(item, identity))
      .filter((row): row is NonNullable<typeof row> => row !== null);

    await writeProductEvents(rows);

    res.status(202).json({ accepted: rows.length });
  }),
);

export { productEventsRouter };

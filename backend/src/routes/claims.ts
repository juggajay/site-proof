import { Router } from 'express';

import { AppError } from '../lib/AppError.js';
import { getEffectiveProjectRole } from '../lib/projectAccess.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { createClaimEvidenceRouter } from './claims/evidenceRoutes.js';
import { createClaimPostEvidenceWorkflowRouter } from './claims/postEvidenceWorkflowRoutes.js';
import { createClaimReadRouter } from './claims/readRoutes.js';
import { createClaimWorkflowRouter } from './claims/workflowRoutes.js';

const router = Router();
const CLAIM_COMMERCIAL_ROLES = ['owner', 'admin', 'project_manager'];
const SUBCONTRACTOR_CLAIM_ROLES = new Set(['subcontractor', 'subcontractor_admin']);
const CLAIM_ID_MAX_LENGTH = 120;

type AuthUser = NonNullable<Express.Request['user']>;

function parseClaimRouteParam(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${field} must be a single value`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw AppError.badRequest(`${field} is required`);
  }

  if (trimmed.length > CLAIM_ID_MAX_LENGTH) {
    throw AppError.badRequest(`${field} is too long`);
  }

  return trimmed;
}

async function requireCommercialProjectAccess(user: AuthUser, projectId: string): Promise<void> {
  if (SUBCONTRACTOR_CLAIM_ROLES.has(user.roleInCompany)) {
    throw AppError.forbidden('Commercial access required');
  }

  const effectiveRole = await getEffectiveProjectRole(user, projectId);
  if (!effectiveRole || !CLAIM_COMMERCIAL_ROLES.includes(effectiveRole)) {
    throw AppError.forbidden('Commercial access required');
  }
}

router.use(
  createClaimReadRouter({
    requireAuth,
    parseClaimRouteParam,
    requireCommercialProjectAccess,
  }),
);

// Mutation and workflow routes require authentication.
router.use(requireAuth);

router.use(
  createClaimWorkflowRouter({
    parseClaimRouteParam,
    requireCommercialProjectAccess,
  }),
);

router.use(
  createClaimEvidenceRouter({
    parseClaimRouteParam,
    requireCommercialProjectAccess,
  }),
);

router.use(
  createClaimPostEvidenceWorkflowRouter({
    parseClaimRouteParam,
    requireCommercialProjectAccess,
  }),
);

export default router;

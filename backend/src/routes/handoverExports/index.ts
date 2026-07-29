// Wave D `D1c.1` — the handover export routes
// (spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §9, §10.1,
// §4.5.4, §4.7.6). **AT-130**, **AT-132**.
//
//   POST /api/projects/:projectId/handover-exports   preflight, then FREEZE
//   GET  /api/projects/:projectId/handover-exports   list
//   GET  /api/handover-exports/:id                   status + progress
//
// NOT HERE, and deliberately: `GET /api/handover-exports/:id/download`. §4.7.4
// makes the download a STREAMED, SHA-verified path and §9 lists it beside the
// worker — it is `D1c.2`'s, and a download route over a `fileUrl` no worker has
// written yet would be a 404 generator with a permission check on it.
//
// NO PAYWALL — `[DH-k]`. See `access.ts`.

import { Router } from 'express';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { AuditAction, createAuditLog } from '../../lib/auditLog.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { requireHandoverProjectAccess, requireHandoverRequesterAccess } from './access.js';
import { createFrozenExport } from './snapshot.js';
import { parseCreateHandoverExportBody } from './validation.js';

/** Mounted at `/api/projects`. */
export const projectHandoverExportsRouter = Router();
/** Mounted at `/api/handover-exports`. */
export const handoverExportsRouter = Router();

projectHandoverExportsRouter.use(requireAuth);
handoverExportsRouter.use(requireAuth);

/** The list/detail shape. `BigInt` is stringified — JSON has no bigint, and
 * `Number()` on a byte count near the 8 GiB cap is the bug §4.5.5 exists to
 * prevent reintroducing. */
function serializeExport(row: {
  id: string;
  projectId: string;
  scope: unknown;
  status: string;
  requestedAt: Date;
  requestedById: string | null;
  snapshotCutoffAt: Date | null;
  totalMembers: number | null;
  processedMembers: number;
  totalBytes: bigint | null;
  fileSize: bigint | null;
  sha256: string | null;
  lastFailureReason: string | null;
  completedAt: Date | null;
  expiresAt: Date | null;
}) {
  return {
    id: row.id,
    projectId: row.projectId,
    scope: row.scope,
    status: row.status,
    requestedAt: row.requestedAt.toISOString(),
    requestedById: row.requestedById,
    snapshotCutoffAt: row.snapshotCutoffAt?.toISOString() ?? null,
    totalMembers: row.totalMembers,
    processedMembers: row.processedMembers,
    totalBytes: row.totalBytes === null ? null : row.totalBytes.toString(),
    fileSize: row.fileSize === null ? null : row.fileSize.toString(),
    sha256: row.sha256,
    lastFailureReason: row.lastFailureReason,
    completedAt: row.completedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
  };
}

const EXPORT_SELECT = {
  id: true,
  projectId: true,
  scope: true,
  status: true,
  requestedAt: true,
  requestedById: true,
  snapshotCutoffAt: true,
  totalMembers: true,
  processedMembers: true,
  totalBytes: true,
  fileSize: true,
  sha256: true,
  lastFailureReason: true,
  completedAt: true,
  expiresAt: true,
} as const;

// POST /api/projects/:projectId/handover-exports
//
// Returns the preflight estimate WITH its unmeasured-member count (§9, §4.5.4)
// — on success in the 201 body, and on refusal in the error details, because
// the number that made the difference is exactly what the requester needs to
// pick a narrower scope.
projectHandoverExportsRouter.post(
  '/:projectId/handover-exports',
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    if (!projectId) throw AppError.badRequest('projectId is required');
    const user = req.user!;
    const { scope } = parseCreateHandoverExportBody(req.body);

    await requireHandoverRequesterAccess(projectId, user);

    const frozen = await createFrozenExport({
      projectId,
      scope,
      requestedById: user.id,
      client: prisma,
    });

    await createAuditLog({
      projectId,
      userId: user.id,
      entityType: 'handover_export',
      entityId: frozen.exportId,
      action: AuditAction.HANDOVER_EXPORT_REQUESTED,
      changes: {
        scopeKind: scope.kind,
        lotCount: frozen.lotCount,
        memberCount: frozen.estimate.memberCount,
      },
      req,
    });

    res.status(201).json({
      id: frozen.exportId,
      status: 'queued',
      lotCount: frozen.lotCount,
      snapshotCutoffAt: frozen.snapshotCutoffAt.toISOString(),
      preflight: {
        estimatedInputBytes: frozen.estimate.estimatedInputBytes.toString(),
        measuredBytes: frozen.estimate.measuredBytes.toString(),
        memberCount: frozen.estimate.memberCount,
        unmeasuredMemberCount: frozen.estimate.unmeasuredMemberCount,
        unmeasuredAssumption: frozen.estimate.unmeasuredAssumption,
        admissionCapBytes: frozen.estimate.admissionCapBytes,
        archivesImpliedAtCap: frozen.estimate.archivesImpliedAtCap,
      },
    });
  }),
);

// GET /api/projects/:projectId/handover-exports
projectHandoverExportsRouter.get(
  '/:projectId/handover-exports',
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    if (!projectId) throw AppError.badRequest('projectId is required');

    await requireHandoverProjectAccess(projectId, req.user!);

    const rows = await prisma.handoverExport.findMany({
      where: { projectId },
      select: EXPORT_SELECT,
      orderBy: { requestedAt: 'desc' },
      take: 50,
    });

    res.json({ exports: rows.map(serializeExport) });
  }),
);

// GET /api/handover-exports/:id
handoverExportsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) throw AppError.badRequest('id is required');

    const row = await prisma.handoverExport.findUnique({
      where: { id },
      select: EXPORT_SELECT,
    });
    if (!row) throw AppError.notFound('Handover export');

    // §10.1: the guard runs against the ROW's own project, resolved from the
    // row — never from a client-supplied `projectId` (**AT-132**).
    await requireHandoverProjectAccess(row.projectId, req.user!);

    const memberStates = await prisma.handoverExportMember.groupBy({
      by: ['state'],
      where: { exportId: id },
      _count: { _all: true },
    });

    res.json({
      ...serializeExport(row),
      memberStates: Object.fromEntries(
        memberStates.map((entry) => [entry.state, entry._count._all]),
      ),
    });
  }),
);

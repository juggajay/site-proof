import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { assertProjectAllowsWrite } from '../lib/projectAccess.js';
import {
  MAX_RELEASE_TOKEN_LENGTH,
  parseHPProjectSettings,
  publicRejectSchema,
  publicReleaseSchema,
  publicReleaseWithConditionsSchema,
  parseHoldPointRouteParam,
} from './holdpoints/validation.js';
import { holdPointReleaseTokenLookup } from './holdpoints/tokens.js';
import { requireSuperintendentApprovalRecipients } from './holdpoints/superintendentRecipients.js';
import { buildPublicHoldPointEvidencePackageResponse } from './holdpoints/evidencePackage.js';
import { buildPublicHoldPointReleasedResponse } from './holdpoints/actionResponses.js';
import { holdPointReadRouter } from './holdpoints/readRoutes.js';
import { holdPointRequestReleaseRouter } from './holdpoints/requestReleaseRoutes.js';
import { holdPointActionRouter } from './holdpoints/actionRoutes.js';
import { holdPointReleaseLinkRouter } from './holdpoints/releaseLinkRoutes.js';
import { holdPointPublicBatchRouter } from './holdpoints/publicBatchRoutes.js';
import { holdPointUnsubscribeRouter } from './holdpoints/unsubscribeRoutes.js';
import { recordHoldPointLinkOpen } from '../lib/holdPointMailConsent.js';
import { parseDocumentContentDisposition, sendDocumentFile } from './documents/fileHelpers.js';
import {
  assertPublicHoldPointTokenAvailable,
  buildPublicHoldPointReleasePayload,
  getPublicEvidenceDocumentIds,
  loadPublicHoldPointReleaseToken,
} from './holdpoints/publicReleasePayload.js';
import {
  buildHoldPointPublicReleaseAuditChanges,
  executeHoldPointTokenRelease,
  rejectTerminalPublicHoldPointRelease,
  runHoldPointReleasePostCommit,
} from './holdpoints/publicReleaseExecution.js';
import { AuditAction } from '../lib/auditLog.js';
import { recordDecision } from '../lib/readiness/recordDecision.js';
import {
  evaluateHoldPointReleaseReadiness,
  holdPointReleaseSnapshots,
  resolveHoldPointReleaseSufficiency,
} from './holdpoints/releaseDecision.js';
import {
  assertPublicDecisionTokenAvailable,
  assertPublicDecisionTokenGetAvailable,
  executePublicHoldPointConditionalRelease,
  executePublicHoldPointRejection,
  loadPublicDecisionToken,
} from './holdpoints/publicDecisionExecution.js';

const holdpointsRouter = Router();

// Authenticated read/detail/evidence routes (project list, lot/item detail,
// evidence package + preview, working hours, notification-time calculation).
// Mounted before the mutation and public token-release routes below so that
// route-match precedence (e.g. GET /:id/evidence-package ahead of the public
// GET /public/:token) is preserved exactly. Extracted verbatim to
// ./holdpoints/readRoutes.js (behavior-preserving).
holdpointsRouter.use(holdPointReadRouter);

// Request hold point release (prerequisite checks, recipient resolution,
// release-token creation, superintendent email + audit). Extracted verbatim to
// ./holdpoints/requestReleaseRoutes.js; mounted after the read routes and
// before the /:id mutation + public token routes so route order is unchanged.
holdpointsRouter.use(holdPointRequestReleaseRouter);

// Authenticated hold point action routes (release, chase, escalate,
// resolve-escalation). Extracted verbatim to ./holdpoints/actionRoutes.js;
// mounted after the request-release route and before the public token-release
// routes so route order and per-route authentication are unchanged.
holdpointsRouter.use(holdPointActionRouter);

// Benchmark T2 — POST /:id/release-link mints a short-lived secure link for a
// co-located approver to scan. Authenticated and role-gated like the other
// mutation routes; mounted after them and before the public token routes so
// its /:id path cannot shadow /public/:token.
holdpointsRouter.use(holdPointReleaseLinkRouter);

// ============================================================================
// PUBLIC ENDPOINTS - No authentication required (Feature #23)
// These endpoints use secure time-limited tokens for superintendent access
// ============================================================================

// The bearer credential for every route below is IN THE URL, and the responses
// carry the evidence package plus the invited recipient's email. A shared cache
// keyed on that URL would hand both to the next reader of the same link, so the
// whole public section is `no-store` — one `use` rather than a header line per
// route, because the property belongs to the section, not to any one handler.
//
// `Referrer-Policy: no-referrer` is NOT repeated here: helmet already sets it
// globally in server.ts (verified against the installed version), and a second
// per-route copy would drift from it.
holdpointsRouter.use('/public', (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  next();
});

// Wave E2.1 — the unsubscribe door for an external recipient with no CIVOS
// account. Mounted at the head of the public section so its two-segment
// /public/unsubscribe/:token path can never be shadowed by the single-token
// routes below.
holdpointsRouter.use(holdPointUnsubscribeRouter);

// Download one file from the token-scoped evidence package (no auth required)
holdpointsRouter.get(
  '/public/:token/documents/:documentId',
  asyncHandler(async (req: Request, res: Response) => {
    const token = parseHoldPointRouteParam(req.params.token, 'token', MAX_RELEASE_TOKEN_LENGTH);
    const documentId = parseHoldPointRouteParam(req.params.documentId, 'documentId');
    const disposition = parseDocumentContentDisposition(req.query.disposition);

    const releaseToken = await loadPublicHoldPointReleaseToken(token);
    assertPublicHoldPointTokenAvailable(releaseToken);
    const { evidencePackage } = await buildPublicHoldPointReleasePayload(releaseToken);
    const scopedDocumentIds = getPublicEvidenceDocumentIds(evidencePackage);

    if (!scopedDocumentIds.has(documentId)) {
      throw AppError.forbidden('This document is not part of this hold point evidence package.');
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        fileUrl: true,
        filename: true,
        mimeType: true,
        projectId: true,
        documentType: true,
      },
    });

    if (!document) {
      throw AppError.notFound('Document');
    }

    await sendDocumentFile(document, res, disposition);
  }),
);

// Get hold point and evidence package via secure link (no auth required)
holdpointsRouter.get(
  '/public/:token',
  asyncHandler(async (req: Request, res: Response) => {
    const token = parseHoldPointRouteParam(req.params.token, 'token', MAX_RELEASE_TOKEN_LENGTH);

    const releaseToken = await loadPublicHoldPointReleaseToken(token);
    assertPublicHoldPointTokenAvailable(releaseToken);
    await assertPublicDecisionTokenGetAvailable(releaseToken.id);
    const { evidencePackage, tokenInfo } = await buildPublicHoldPointReleasePayload(releaseToken);

    // Wave E2.1 — the implied-consent signal. Only on a real GET: Express hands
    // HEAD to this handler too, and a mail scanner's HEAD probe is not a human
    // opening a link. AT-112's HEAD purity therefore stays literally true, and
    // its GET assertions are unaffected — they pin `usedAt`, the release
    // columns, `expiresAt`, the audit count and the notification count, none of
    // which this touches. Recording an open is not a decision.
    if (req.method === 'GET' && !releaseToken.openedAt) {
      await recordHoldPointLinkOpen({
        projectId: releaseToken.holdPoint.lot.projectId,
        recipientEmail: releaseToken.recipientEmail,
        stampOpenedAt: () =>
          prisma.holdPointReleaseToken.updateMany({
            where: { id: releaseToken.id, openedAt: null },
            data: { openedAt: new Date() },
          }),
      });
    }

    res.json(buildPublicHoldPointEvidencePackageResponse(evidencePackage, tokenInfo));
  }),
);

// Refuse release via the round-bound secure link (no auth required).
holdpointsRouter.post(
  '/public/:token/reject',
  asyncHandler(async (req: Request, res: Response) => {
    const token = parseHoldPointRouteParam(req.params.token, 'token', MAX_RELEASE_TOKEN_LENGTH);
    const parsed = publicRejectSchema.safeParse(req.body);
    if (!parsed.success) throw AppError.fromZodError(parsed.error);

    const releaseToken = await loadPublicDecisionToken(token);
    assertPublicDecisionTokenAvailable(releaseToken);
    const result = await executePublicHoldPointRejection({
      releaseToken,
      ...parsed.data,
      req,
    });
    res.json({
      success: true,
      message: 'Hold point release refused and NCR raised',
      holdPoint: result.holdPoint,
      ncr: result.ncr,
    });
  }),
);

// Grant permission to proceed subject to recorded authority conditions.
holdpointsRouter.post(
  '/public/:token/release-with-conditions',
  asyncHandler(async (req: Request, res: Response) => {
    const token = parseHoldPointRouteParam(req.params.token, 'token', MAX_RELEASE_TOKEN_LENGTH);
    const parsed = publicReleaseWithConditionsSchema.safeParse(req.body);
    if (!parsed.success) throw AppError.fromZodError(parsed.error);

    const releaseToken = await loadPublicDecisionToken(token);
    assertPublicDecisionTokenAvailable(releaseToken);
    const result = await executePublicHoldPointConditionalRelease({
      releaseToken,
      ...parsed.data,
      req,
    });
    res.json({
      success: true,
      message: 'Hold point released with conditions via secure link',
      holdPoint: result.holdPoint,
      conditions: parsed.data.conditions,
    });
  }),
);

// Release hold point via secure link (no auth required)
holdpointsRouter.post(
  '/public/:token/release',
  asyncHandler(async (req: Request, res: Response) => {
    const token = parseHoldPointRouteParam(req.params.token, 'token', MAX_RELEASE_TOKEN_LENGTH);
    const parseResult = publicReleaseSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.fromZodError(parseResult.error);
    }

    const { releasedByName, releasedByOrg, releaseNotes, signatureDataUrl } = parseResult.data;

    // Find the token and validate it
    const releaseToken = await prisma.holdPointReleaseToken.findFirst({
      where: holdPointReleaseTokenLookup(token),
      include: {
        holdPoint: {
          include: {
            lot: {
              include: {
                project: true,
              },
            },
            itpChecklistItem: true,
          },
        },
      },
    });

    if (!releaseToken) {
      throw AppError.notFound('Invalid or expired link');
    }

    // Check if token has expired
    if (new Date() > releaseToken.expiresAt) {
      throw new AppError(
        410,
        'This secure release link has expired. Please contact the site team for a new link.',
        'TOKEN_EXPIRED',
      );
    }

    // Check if token has been used
    if (releaseToken.usedAt) {
      throw new AppError(
        410,
        'This hold point has already been released using this link.',
        'TOKEN_USED',
        {
          releasedAt: releaseToken.usedAt as unknown as Record<string, unknown>,
          releasedByName: releaseToken.releasedByName as unknown as Record<string, unknown>,
        },
      );
    }

    rejectTerminalPublicHoldPointRelease(releaseToken.holdPoint.status);

    const projectSettings = parseHPProjectSettings(releaseToken.holdPoint.lot.project.settings);
    const tokenRecipientName = releaseToken.recipientName?.trim();
    const effectiveReleasedByName = tokenRecipientName || releasedByName;
    await assertProjectAllowsWrite(releaseToken.holdPoint.lot.projectId);
    await requireSuperintendentApprovalRecipients(
      releaseToken.holdPoint.lot.projectId,
      projectSettings,
      [
        {
          email: releaseToken.recipientEmail,
          fullName: releaseToken.recipientName,
        },
      ],
    );

    const releasedAt = new Date();
    // Wave C1.2 (§5.2, §3.4.3 `[C1R-B7]`): the sufficiency advisory is resolved
    // outside the decision transaction, as on the other two release doors.
    const releaseSufficiency = await resolveHoldPointReleaseSufficiency(
      releaseToken.holdPoint.lotId,
    );
    // F0.4b PR 3: the token claim, the release columns, the ITP reconciliation
    // and the audit row now commit as ONE serializable transaction.
    const decision = await recordDecision({
      projectId: releaseToken.holdPoint.lot.projectId,
      entityType: 'hold_point',
      entityId: releaseToken.holdPoint.id,
      decisionKind: 'release',
      auditAction: AuditAction.HP_PUBLIC_RELEASED,
      // Public door: the actor is the TOKEN ROW, labelled with the identity the
      // site team addressed the link to. `recipientName`, never `recipientEmail`
      // and never the submitted free-text name (`[R3.1]`, review R7).
      actor: {
        kind: 'external_token',
        tokenId: releaseToken.id,
        label: releaseToken.recipientName ?? undefined,
      },
      auditChanges: buildHoldPointPublicReleaseAuditChanges({
        effectiveReleasedByName,
        submittedReleasedByName: releasedByName,
        releasedByOrg,
        tokenRecipientEmail: releaseToken.recipientEmail,
        tokenRecipientName: releaseToken.recipientName,
      }),
      req,
      // Read-only. Every release-eligibility gate this route has (token unused +
      // unexpired, hold point non-terminal, ITP completion not failed) already
      // runs inside the transaction, in `executeHoldPointTokenRelease` — and
      // those gates own the route's pinned 410 TOKEN_USED / TOKEN_EXPIRED
      // responses, so duplicating them here would change which error a replay
      // sees. Nothing to move; `evaluate` only reads the readiness to snapshot.
      evaluate: (tx) =>
        evaluateHoldPointReleaseReadiness(
          tx,
          [releaseToken.holdPoint.id],
          releaseToken.holdPoint.lotId,
          releaseSufficiency,
        ),
      // Unchanged, and still shared verbatim with the batch route: the token
      // claim and both optimistic guards stay exactly as they were.
      mutate: (tx) =>
        executeHoldPointTokenRelease(tx, {
          tokenId: releaseToken.id,
          holdPointId: releaseToken.holdPoint.id,
          releasedAt,
          effectiveReleasedByName,
          releasedByOrg,
          releaseNotes,
          signatureDataUrl,
        }),
      snapshots: (evaluation) => holdPointReleaseSnapshots([releaseToken.holdPoint.id], evaluation),
    });

    // No requestKey on this route: token semantics are unchanged, so a reused
    // token still gets the existing 410 from the in-transaction guard rather
    // than a `recordDecision` replay (`[R3.1-B2]`). `mutation` is always present.
    const { holdPoint, releasedItpInstanceId } = decision.mutation!;

    await runHoldPointReleasePostCommit({
      holdPoint,
      project: releaseToken.holdPoint.lot.project,
      releasedItpInstanceId,
      releasedAt,
      effectiveReleasedByName,
      releasedByOrg,
      releaseNotes,
    });

    res.json(buildPublicHoldPointReleasedResponse(holdPoint));
  }),
);

// Public batch review-room endpoints (summary, per-hold-point evidence + file
// download, and batch release). Same hashed-token validation and reused
// evidence/release logic as the single /public/:token routes; mounted here
// alongside them, before any route-wide auth. Their /public/batch/... paths do
// not collide with the single /public/:token routes above.
holdpointsRouter.use(holdPointPublicBatchRouter);

export { holdpointsRouter };

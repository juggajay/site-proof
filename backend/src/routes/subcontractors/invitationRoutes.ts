import { Router, type Request } from 'express';

import { AppError } from '../../lib/AppError.js';
import { createAuditLog, AuditAction } from '../../lib/auditLog.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { createEmailDeliveryFailureError } from '../../lib/emailDeliveryErrors.js';
import { sendSubcontractorInvitationEmail } from '../../lib/email.js';
import { prisma } from '../../lib/prisma.js';
import { buildFrontendUrl } from '../../lib/runtimeConfig.js';
import { logError } from '../../lib/serverLogger.js';
import { requireEmailVerified } from '../../middleware/requireEmailVerified.js';
import { requireBrowserSessionMiddleware } from '../../middleware/browserSession.js';
import {
  generateSubcontractorInvitationToken,
  getSubcontractorInvitationExpiresAt,
  hashSubcontractorInvitationToken,
  isSubcontractorInvitationToken,
  isSubcontractorInvitationAcceptableStatus,
  isSubcontractorInvitationExpired,
  maskInvitedEmail,
  normalizeSubcontractorInvitationToken,
} from '../../lib/subcontractorInvitations.js';
import {
  buildEmptyPendingSubcontractorInvitationResponse,
  buildSubcontractorInvitationAcceptedResponse,
  buildSubcontractorInvitationDetailsResponse,
  buildSubcontractorInvitedResponse,
  buildSubcontractorsForProjectResponse,
  buildUserPendingSubcontractorInvitationResponse,
} from './invitationResponses.js';

type AuthenticatedUser = NonNullable<Request['user']>;

export interface SubcontractorInvitationRouterDependencies {
  blockedSubcontractorStatuses: Set<string>;
  headContractorCompanyRoles: Set<string>;
  idMaxLength: number;
  companyNameMaxLength: number;
  personNameMaxLength: number;
  normalizeIdParam(value: unknown, field?: string): string;
  normalizeRequiredText(value: unknown, field: string, maxLength: number): string;
  normalizeOptionalText(value: unknown, field: string, maxLength: number): string | null;
  normalizeEmail(value: unknown, field: string): string;
  normalizeOptionalPhone(value: unknown, field: string): string | null;
  normalizeOptionalAbn(value: unknown): string | null;
  companyNameMatches(a: string, b: string): boolean;
  isSubcontractorPortalRole(user: AuthenticatedUser): boolean;
  requireSubcontractorProjectAccess(
    projectId: string,
    user: AuthenticatedUser,
    manage?: boolean,
    options?: { requireWritable?: boolean },
  ): Promise<unknown>;
}

export interface SubcontractorInvitationRouters {
  publicRouter: Router;
  authenticatedRouter: Router;
}

function toInvitationTokenHash(value: string): string | null {
  if (!isSubcontractorInvitationToken(value)) {
    return null;
  }

  try {
    return hashSubcontractorInvitationToken(normalizeSubcontractorInvitationToken(value));
  } catch {
    return null;
  }
}

async function cleanupFailedSubcontractorInvitation(params: {
  subcontractorId: string;
  globalSubcontractorId: string | null;
  createdGlobalSubcontractor: boolean;
}) {
  const { subcontractorId, globalSubcontractorId, createdGlobalSubcontractor } = params;

  await prisma.$transaction(async (tx) => {
    await tx.auditLog.deleteMany({
      where: {
        entityType: 'subcontractor',
        entityId: subcontractorId,
        action: AuditAction.SUBCONTRACTOR_INVITED,
      },
    });
    await tx.subcontractorCompany.delete({ where: { id: subcontractorId } }).catch(() => {});

    if (createdGlobalSubcontractor && globalSubcontractorId) {
      await tx.globalSubcontractor
        .deleteMany({
          where: {
            id: globalSubcontractorId,
            projectSubcontractors: { none: {} },
          },
        })
        .catch(() => {});
    }
  });
}

export function createSubcontractorInvitationRouters({
  blockedSubcontractorStatuses,
  headContractorCompanyRoles,
  idMaxLength,
  companyNameMaxLength,
  personNameMaxLength,
  normalizeIdParam,
  normalizeRequiredText,
  normalizeOptionalText,
  normalizeEmail,
  normalizeOptionalPhone,
  normalizeOptionalAbn,
  companyNameMatches,
  isSubcontractorPortalRole,
  requireSubcontractorProjectAccess,
}: SubcontractorInvitationRouterDependencies): SubcontractorInvitationRouters {
  const publicRouter = Router();
  const authenticatedRouter = Router();

  function assertInvitationAcceptable(status: string): void {
    if (!isSubcontractorInvitationAcceptableStatus(status)) {
      throw AppError.forbidden('This invitation is no longer active');
    }
  }

  // Feature #484: GET /api/subcontractors/invitation/:id - Get invitation details (no auth required)
  // This allows the frontend to display invitation info before user creates account
  publicRouter.get(
    '/invitation/:id',
    asyncHandler(async (req, res) => {
      const invitationTokenHash = toInvitationTokenHash(req.params.id);

      if (!invitationTokenHash) {
        throw AppError.notFound('Invitation');
      }

      const subcontractor = await prisma.subcontractorCompany.findUnique({
        where: { invitationTokenHash },
        include: {
          project: { select: { id: true, name: true, companyId: true } },
          _count: { select: { users: true } },
        },
      });

      if (!subcontractor) {
        throw AppError.notFound('Invitation');
      }

      if (blockedSubcontractorStatuses.has(subcontractor.status)) {
        throw AppError.notFound('Invitation');
      }

      if (isSubcontractorInvitationExpired(subcontractor)) {
        throw AppError.notFound('Invitation');
      }

      // Get the head contractor company name
      const headContractor = await prisma.company.findUnique({
        where: { id: subcontractor.project.companyId },
        select: { name: true },
      });

      res.json(
        buildSubcontractorInvitationDetailsResponse(
          subcontractor,
          headContractor?.name || 'Unknown',
          isSubcontractorInvitationAcceptableStatus(subcontractor.status) &&
            subcontractor._count.users === 0,
        ),
      );
    }),
  );

  // GET /api/subcontractors/my-pending-invitation - Find the current user's invite without email link
  authenticatedRouter.get(
    '/my-pending-invitation',
    asyncHandler(async (req, res) => {
      const user = req.user!;
      const email = user.email.trim();
      const now = new Date();

      const invitation = await prisma.subcontractorCompany.findFirst({
        where: {
          status: { in: ['pending_approval', 'approved'] },
          primaryContactEmail: { equals: email, mode: 'insensitive' },
          OR: [{ invitationExpiresAt: null }, { invitationExpiresAt: { gt: now } }],
          users: { none: {} },
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              company: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!invitation) {
        res.json(buildEmptyPendingSubcontractorInvitationResponse());
        return;
      }

      res.json(buildUserPendingSubcontractorInvitationResponse(invitation));
    }),
  );

  // POST /api/subcontractors/invite - Invite/create a new subcontractor company for a project
  // Now supports selecting from global directory via globalSubcontractorId
  authenticatedRouter.post(
    '/invite',
    requireBrowserSessionMiddleware('Subcontractor invitation'),
    requireEmailVerified,
    asyncHandler(async (req, res) => {
      const user = req.user!;
      const { companyName, abn, primaryContactName, primaryContactEmail, primaryContactPhone } =
        req.body;
      const projectId = normalizeRequiredText(req.body.projectId, 'projectId', idMaxLength);
      const globalSubcontractorId = normalizeOptionalText(
        req.body.globalSubcontractorId,
        'globalSubcontractorId',
        idMaxLength,
      );

      // Validate required fields
      if (!projectId) {
        throw AppError.badRequest('projectId is required');
      }

      // If not selecting from directory, require all fields
      const inputCompanyName = globalSubcontractorId
        ? null
        : normalizeRequiredText(companyName, 'companyName', companyNameMaxLength);
      const inputContactName = globalSubcontractorId
        ? null
        : normalizeRequiredText(primaryContactName, 'primaryContactName', personNameMaxLength);
      const inputContactEmail = globalSubcontractorId
        ? null
        : normalizeEmail(primaryContactEmail, 'primaryContactEmail');
      const inputContactPhone = globalSubcontractorId
        ? null
        : normalizeOptionalPhone(primaryContactPhone, 'primaryContactPhone');
      const inputAbn = globalSubcontractorId ? null : normalizeOptionalAbn(abn);

      // Verify project exists and user has access
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        throw AppError.notFound('Project');
      }

      await requireSubcontractorProjectAccess(projectId, user, true, { requireWritable: true });

      // Determine the company details to use
      let finalCompanyName: string;
      let finalAbn: string | null;
      let finalContactName: string;
      let finalContactEmail: string;
      let finalContactPhone: string | null;
      let globalId: string | null = null;
      let createdGlobalSubcontractor = false;

      if (globalSubcontractorId) {
        // Selecting from directory - fetch the global subcontractor
        const globalSub = await prisma.globalSubcontractor.findUnique({
          where: { id: globalSubcontractorId },
        });

        if (!globalSub) {
          throw AppError.notFound('Global subcontractor');
        }

        // Verify it belongs to the same organization
        if (globalSub.organizationId !== project.companyId) {
          throw AppError.forbidden('This subcontractor does not belong to your organization');
        }

        // Check if this global subcontractor is already invited to this project
        const existingLink = await prisma.subcontractorCompany.findFirst({
          where: {
            projectId,
            globalSubcontractorId,
          },
        });

        if (existingLink) {
          throw AppError.conflict('This subcontractor has already been invited to this project');
        }

        finalCompanyName = normalizeRequiredText(
          globalSub.companyName,
          'companyName',
          companyNameMaxLength,
        );
        finalAbn = normalizeOptionalAbn(globalSub.abn);
        finalContactName = normalizeRequiredText(
          globalSub.primaryContactName,
          'primaryContactName',
          personNameMaxLength,
        );
        finalContactEmail = normalizeEmail(globalSub.primaryContactEmail, 'primaryContactEmail');
        finalContactPhone = normalizeOptionalPhone(
          globalSub.primaryContactPhone,
          'primaryContactPhone',
        );
        globalId = globalSub.id;
      } else {
        // Check if a subcontractor with same name already exists for this project
        const existingSubcontractors = await prisma.subcontractorCompany.findMany({
          where: {
            projectId,
          },
          select: { companyName: true },
        });

        if (
          existingSubcontractors.some((existing) =>
            companyNameMatches(existing.companyName, inputCompanyName!),
          )
        ) {
          throw AppError.conflict(
            'A subcontractor with this company name already exists for this project',
          );
        }

        const existingGlobalSubs = await prisma.globalSubcontractor.findMany({
          where: { organizationId: project.companyId },
          select: { id: true, companyName: true },
        });
        const existingGlobalSub = existingGlobalSubs.find((existing) =>
          companyNameMatches(existing.companyName, inputCompanyName!),
        );
        globalId = existingGlobalSub?.id || null;

        if (!globalId) {
          // Create a new GlobalSubcontractor record
          const newGlobalSub = await prisma.globalSubcontractor.create({
            data: {
              organizationId: project.companyId,
              companyName: inputCompanyName!,
              abn: inputAbn,
              primaryContactName: inputContactName!,
              primaryContactEmail: inputContactEmail!,
              primaryContactPhone: inputContactPhone,
              status: 'active',
            },
          });
          globalId = newGlobalSub.id;
          createdGlobalSubcontractor = true;
        }

        finalCompanyName = inputCompanyName!;
        finalAbn = inputAbn;
        finalContactName = inputContactName!;
        finalContactEmail = inputContactEmail!;
        finalContactPhone = inputContactPhone;
      }

      // Create the project-specific SubcontractorCompany linked to the global record
      const invitationToken = generateSubcontractorInvitationToken();
      const subcontractor = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          globalSubcontractorId: globalId,
          companyName: finalCompanyName,
          abn: finalAbn,
          primaryContactName: finalContactName,
          primaryContactEmail: finalContactEmail,
          primaryContactPhone: finalContactPhone,
          status: 'pending_approval',
          invitationExpiresAt: getSubcontractorInvitationExpiresAt(),
          invitationTokenHash: hashSubcontractorInvitationToken(invitationToken),
        },
      });

      await createAuditLog({
        projectId,
        userId: user.id,
        entityType: 'subcontractor',
        entityId: subcontractor.id,
        action: AuditAction.SUBCONTRACTOR_INVITED,
        changes: {
          companyName: subcontractor.companyName,
          primaryContactEmail: subcontractor.primaryContactEmail,
          status: subcontractor.status,
          globalSubcontractorId: globalId,
        },
        req,
      });

      // Feature #942 - Send subcontractor invitation email with setup link
      const inviteUrl = buildFrontendUrl(
        `/subcontractor-portal/accept-invite?id=${encodeURIComponent(invitationToken)}`,
      );

      let emailResult;
      try {
        emailResult = await sendSubcontractorInvitationEmail({
          to: finalContactEmail,
          contactName: finalContactName,
          companyName: finalCompanyName,
          projectName: project.name,
          inviterEmail: user.email,
          inviteUrl,
        });
      } catch (emailError) {
        logError('[Subcontractor Invite] Failed to send email:', emailError);
        await cleanupFailedSubcontractorInvitation({
          subcontractorId: subcontractor.id,
          globalSubcontractorId: globalId,
          createdGlobalSubcontractor,
        });
        throw AppError.internal('Subcontractor invitation email could not be sent');
      }

      if (!emailResult.success) {
        logError('[Subcontractor Invite] Failed to send email:', emailResult.error);
        await cleanupFailedSubcontractorInvitation({
          subcontractorId: subcontractor.id,
          globalSubcontractorId: globalId,
          createdGlobalSubcontractor,
        });
        throw createEmailDeliveryFailureError(emailResult, {
          quotaMessage:
            'Subcontractor invitation email could not be sent because the email provider daily sending quota has been reached.',
          unavailableMessage:
            'Subcontractor invitation email could not be sent because email delivery is temporarily unavailable.',
        });
      }

      res.status(201).json(buildSubcontractorInvitedResponse(subcontractor));
    }),
  );

  // GET /api/subcontractors/for-project/:projectId - Get subcontractors for a project
  authenticatedRouter.get(
    '/for-project/:projectId',
    asyncHandler(async (req, res) => {
      const user = req.user!;
      const projectId = normalizeIdParam(req.params.projectId, 'Project ID');

      await requireSubcontractorProjectAccess(projectId, user, false, { requireWritable: true });

      // Get all subcontractor companies associated with this project
      const subcontractors = await prisma.subcontractorCompany.findMany({
        where: {
          projectId: projectId,
        },
        select: {
          id: true,
          companyName: true,
          status: true,
        },
        orderBy: { companyName: 'asc' },
      });

      res.json(buildSubcontractorsForProjectResponse(subcontractors));
    }),
  );

  // Feature #484: POST /api/subcontractors/invitation/:id/accept - Accept invitation and link user
  authenticatedRouter.post(
    '/invitation/:id/accept',
    asyncHandler(async (req, res) => {
      const invitationTokenHash = toInvitationTokenHash(req.params.id);
      const id = invitationTokenHash ? null : normalizeIdParam(req.params.id, 'Invitation ID');
      const user = req.user!;

      // Find the subcontractor company
      const subcontractor = await prisma.subcontractorCompany.findUnique({
        where: invitationTokenHash ? { invitationTokenHash } : { id: id! },
        include: {
          project: { select: { id: true, name: true } },
        },
      });

      if (!subcontractor) {
        throw AppError.notFound('Invitation');
      }

      if (blockedSubcontractorStatuses.has(subcontractor.status)) {
        throw AppError.notFound('Invitation');
      }

      if (isSubcontractorInvitationExpired(subcontractor)) {
        throw AppError.notFound('Invitation');
      }

      // Possession of the invitation link is the security boundary, not email
      // equality — head contractors typo addresses and subbies often already
      // have an account under another email. On a mismatch we surface a distinct
      // EMAIL_MISMATCH error (with the invited address masked so it isn't leaked
      // to a different logged-in account) so the UI can offer an explicit,
      // audited confirmation instead of a dead-end.
      const invitedEmail = subcontractor.primaryContactEmail?.trim().toLowerCase();
      const actualEmail = user.email.trim().toLowerCase();
      const emailMismatch = Boolean(invitedEmail && invitedEmail !== actualEmail);
      const acknowledgeEmailMismatch =
        (req.body as { acknowledgeEmailMismatch?: unknown } | undefined)
          ?.acknowledgeEmailMismatch === true;

      if (emailMismatch && !invitationTokenHash) {
        throw new AppError(
          403,
          'Use the invitation link sent to the invited email address to accept this invitation with a different account.',
          'INVITATION_TOKEN_REQUIRED',
          { invitedEmailMasked: maskInvitedEmail(subcontractor.primaryContactEmail ?? '') },
        );
      }

      if (emailMismatch && !acknowledgeEmailMismatch) {
        throw new AppError(
          409,
          `This invitation was sent to ${maskInvitedEmail(subcontractor.primaryContactEmail ?? '')}. You're signed in as ${user.email}. Accept it with this account?`,
          'EMAIL_MISMATCH',
          { invitedEmailMasked: maskInvitedEmail(subcontractor.primaryContactEmail ?? '') },
        );
      }

      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id
          FROM subcontractor_companies
          WHERE id = ${subcontractor.id}
          FOR UPDATE
        `;

        const lockedSubcontractor = await tx.subcontractorCompany.findUnique({
          where: { id: subcontractor.id },
          select: {
            id: true,
            status: true,
            invitationExpiresAt: true,
          },
        });

        if (!lockedSubcontractor) {
          throw AppError.notFound('Invitation');
        }

        if (blockedSubcontractorStatuses.has(lockedSubcontractor.status)) {
          throw AppError.notFound('Invitation');
        }

        if (isSubcontractorInvitationExpired(lockedSubcontractor)) {
          throw AppError.notFound('Invitation');
        }

        const currentUser = await tx.user.findUnique({
          where: { id: user.id },
          select: { companyId: true, roleInCompany: true },
        });

        if (!currentUser) {
          throw AppError.unauthorized('Invalid user session');
        }

        if (
          currentUser.companyId ||
          headContractorCompanyRoles.has(currentUser.roleInCompany || '')
        ) {
          throw AppError.forbidden(
            'Head contractor company accounts cannot accept subcontractor invitations. Use a separate subcontractor account.',
          );
        }

        const existingLinks = await tx.subcontractorUser.findMany({
          where: { subcontractorCompanyId: lockedSubcontractor.id },
          select: { userId: true },
        });
        const existingLink = existingLinks.find((link) => link.userId === user.id);

        if (existingLink) {
          throw AppError.badRequest('Your account is already linked to this subcontractor company');
        }

        if (existingLinks.length > 0) {
          throw AppError.badRequest('This invitation has already been accepted by another user');
        }

        assertInvitationAcceptable(lockedSubcontractor.status);

        if (lockedSubcontractor.status === 'pending_approval') {
          const statusUpdate = await tx.subcontractorCompany.updateMany({
            where: { id: lockedSubcontractor.id, status: 'pending_approval' },
            data: { status: 'approved' },
          });

          if (statusUpdate.count !== 1) {
            throw AppError.badRequest('This invitation has already been accepted by another user');
          }
        }

        await tx.subcontractorUser.create({
          data: {
            userId: user.id,
            subcontractorCompanyId: lockedSubcontractor.id,
            role: 'admin', // First user is admin
          },
        });

        if (!isSubcontractorPortalRole({ ...user, roleInCompany: currentUser.roleInCompany })) {
          await tx.user.update({
            where: { id: user.id },
            data: { roleInCompany: 'subcontractor_admin' },
          });
        }
      });

      // Audit log for subcontractor invitation acceptance. When the accepting
      // account's email differs from the invited contact, record both addresses
      // (full values are fine in the audit trail) so the reconciliation is
      // traceable.
      await createAuditLog({
        projectId: subcontractor.project.id,
        userId: user.id,
        entityType: 'subcontractor',
        entityId: subcontractor.id,
        action: AuditAction.SUBCONTRACTOR_INVITATION_ACCEPTED,
        changes: {
          companyName: subcontractor.companyName,
          ...(emailMismatch && {
            emailMismatchAcknowledged: true,
            invitedEmail: subcontractor.primaryContactEmail,
            acceptedEmail: user.email,
          }),
        },
        req,
      });

      res.json(buildSubcontractorInvitationAcceptedResponse(subcontractor));
    }),
  );

  return { publicRouter, authenticatedRouter };
}

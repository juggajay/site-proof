import { Router } from 'express';
import crypto from 'crypto';

import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { buildFrontendUrl } from '../../lib/runtimeConfig.js';
import { assertCanRemoveUserFromProjectAdminRoles } from '../../lib/projectAdminInvariant.js';
import { logError } from '../../lib/serverLogger.js';
import { AuditAction, createAuditLog, writeAuditLogInTransaction } from '../../lib/auditLog.js';
import { sendCompanyMemberInvitationEmail, sendNotificationEmail } from '../../lib/email.js';
import { createEmailDeliveryFailureError } from '../../lib/emailDeliveryErrors.js';
import { requireEmailVerified } from '../../middleware/requireEmailVerified.js';
import {
  TIER_QUOTA_ENFORCEMENT_ENABLED,
  getUserLimitForTier,
  normalizeSubscriptionTier,
} from '../../lib/tierLimits.js';
import {
  buildCompanyLeftResponse,
  buildCompanyMemberInvitedResponse,
  buildCompanyMemberRemovedResponse,
  buildCompanyMemberRoleChangedResponse,
  buildCompanyMembersResponse,
  buildCompanyOwnershipTransferredResponse,
} from './responses.js';
import {
  COMPANY_MEMBER_FULL_NAME_MAX_LENGTH,
  normalizeCompanyMemberEmail,
  normalizeCompanyMemberRole,
  normalizeCompanyString,
} from './validation.js';
import {
  assertActorMayManageCompanyMemberRole,
  COMPANY_SUBCONTRACTOR_ROLES,
  requireBrowserSession,
  requireCompanyAdmin,
} from './access.js';
import {
  shouldMarkInvitedMemberVerified,
  shouldNotifyAttachedCompanyMember,
} from './memberInvitation.js';

const COMPANY_MEMBER_INVITATION_EXPIRES_DAYS = 7;
const ONE_TIME_TOKEN_HASH_PREFIX = 'sha256:';
const COMPANY_MEMBER_INVITATION_EMAIL_FAILURE_COPY = {
  quotaMessage: 'Company invitation email quota exceeded. Please try again later.',
  unavailableMessage: 'Company invitation email could not be sent',
};

export const companyMemberRoutes = Router();

type CompanyMemberInvitationRollbackState = {
  id: string;
  fullName: string | null;
  companyId: string | null;
  roleInCompany: string;
  emailVerified: boolean;
  emailVerifiedAt: Date | null;
};

function hashOneTimeToken(token: string): string {
  return `${ONE_TIME_TOKEN_HASH_PREFIX}${crypto.createHash('sha256').update(token).digest('hex')}`;
}

async function cleanupFailedCompanyMemberInvitation(params: {
  memberId: string;
  setupToken: string;
  createdUser: boolean;
  previousMemberState: CompanyMemberInvitationRollbackState | null;
  previousActiveSetupTokenIds: string[];
}) {
  const setupTokenHash = hashOneTimeToken(params.setupToken);

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.deleteMany({
      where: { userId: params.memberId, token: setupTokenHash, usedAt: null },
    });

    if (params.createdUser) {
      await tx.emailVerificationToken.deleteMany({ where: { userId: params.memberId } });
      await tx.projectUser.deleteMany({ where: { userId: params.memberId } });
      await tx.user.delete({ where: { id: params.memberId } }).catch(() => {});
      return;
    }

    if (params.previousActiveSetupTokenIds.length > 0) {
      await tx.passwordResetToken.updateMany({
        where: { id: { in: params.previousActiveSetupTokenIds } },
        data: { usedAt: null },
      });
    }

    if (params.previousMemberState) {
      await tx.user.update({
        where: { id: params.memberId },
        data: {
          fullName: params.previousMemberState.fullName,
          companyId: params.previousMemberState.companyId,
          roleInCompany: params.previousMemberState.roleInCompany,
          emailVerified: params.previousMemberState.emailVerified,
          emailVerifiedAt: params.previousMemberState.emailVerifiedAt,
        },
      });
    }
  });
}

// POST /api/company/leave - Leave the current company
companyMemberRoutes.post(
  '/leave',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    requireBrowserSession(req, 'Company leave');

    if (!user.companyId) {
      throw AppError.badRequest('You are not a member of any company');
    }

    // Don't allow owners to leave until someone else owns the company.
    if (user.roleInCompany === 'owner') {
      throw AppError.forbidden('Company owners cannot leave. Please transfer ownership first.');
    }

    const companyId = user.companyId;
    const previousRole = user.roleInCompany || null;
    let removedProjectMembershipCount = 0;
    let revokedApiKeyCount = 0;
    await prisma.$transaction(async (tx) => {
      await assertCanRemoveUserFromProjectAdminRoles(user.userId, {
        companyId,
        actionDescription: 'leave company',
        subjectDescription: 'you are',
        client: tx,
      });

      // Remove user from all project memberships for this company
      const companyProjects = await tx.project.findMany({
        where: { companyId },
        select: { id: true },
      });

      const projectIds = companyProjects.map((p) => p.id);

      // Delete project user records
      const removedProjectMemberships = await tx.projectUser.deleteMany({
        where: {
          userId: user.userId,
          projectId: { in: projectIds },
        },
      });
      removedProjectMembershipCount = removedProjectMemberships.count;

      // M72(a): revoke the leaving user's API keys. The user row is kept (only
      // detached from the company), so their keys would otherwise stay active and
      // continue to authenticate against the API after they leave.
      const revokedApiKeys = await tx.apiKey.updateMany({
        where: { userId: user.userId, isActive: true },
        data: { isActive: false },
      });
      revokedApiKeyCount = revokedApiKeys.count;

      // Remove company association from user using raw SQL to avoid Prisma quirks
      // Set role_in_company to 'member' (default) since it's NOT NULL
      await tx.$executeRaw`UPDATE users SET company_id = NULL, role_in_company = 'member' WHERE id = ${user.userId}`;

      await writeAuditLogInTransaction(tx, {
        userId: user.userId,
        entityType: 'company',
        entityId: companyId,
        action: AuditAction.COMPANY_MEMBER_LEFT,
        changes: {
          memberUserId: user.userId,
          previousRole,
          removedProjectMembershipCount,
          // Field name avoids the audit redactor's /api[-_]?key/i pattern — a count
          // of revoked keys is not sensitive and must stay readable in the log.
          revokedKeyCount: revokedApiKeyCount,
        },
        req,
      });
    });

    res.json(buildCompanyLeftResponse(new Date()));
  }),
);

// GET /api/company/members - Get all members of the current user's company
companyMemberRoutes.get(
  '/members',
  asyncHandler(async (req, res) => {
    const user = req.user!;

    if (!user.companyId) {
      throw AppError.notFound('Company');
    }

    // Owners/admins can view members for team management. Ownership transfer
    // remains owner-only in POST /transfer-ownership.
    if (!['owner', 'admin'].includes(user.roleInCompany || '')) {
      throw AppError.forbidden('Only company owners and admins can view company members');
    }

    const members = await prisma.user.findMany({
      where: { companyId: user.companyId },
      select: {
        id: true,
        email: true,
        fullName: true,
        roleInCompany: true,
        passwordHash: true,
        oauthProvider: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { fullName: 'asc' },
    });

    res.json(buildCompanyMembersResponse(members));
  }),
);

// POST /api/company/members/invite - Invite or attach a user to the current company
companyMemberRoutes.post(
  '/members/invite',
  requireEmailVerified,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    requireBrowserSession(req, 'Company member invitation');
    const companyId = requireCompanyAdmin(user);
    const email = normalizeCompanyMemberEmail(req.body.email);
    const roleInCompany = normalizeCompanyMemberRole(req.body.roleInCompany ?? req.body.role);
    const fullName = normalizeCompanyString(
      req.body.fullName,
      'Full name',
      COMPANY_MEMBER_FULL_NAME_MAX_LENGTH,
    );

    const setupToken = crypto.randomBytes(32).toString('hex');
    const setupExpiresAt = new Date(
      Date.now() + COMPANY_MEMBER_INVITATION_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
    );

    const {
      company,
      member,
      setupRequired,
      createdUser,
      previousMemberState,
      previousActiveSetupTokenIds,
      notifyAttachedMember,
    } = await prisma.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({
        where: { id: user.userId },
        select: { companyId: true, roleInCompany: true },
      });

      if (!currentUser?.companyId) {
        throw AppError.notFound('Company');
      }

      if (currentUser.companyId !== companyId) {
        throw AppError.forbidden('Invalid company session');
      }

      if (!['owner', 'admin'].includes(currentUser.roleInCompany || '')) {
        throw AppError.forbidden('Only company owners and admins can invite company members');
      }

      await tx.$queryRaw`
        SELECT id
        FROM companies
        WHERE id = ${companyId}
        FOR UPDATE
      `;

      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: { id: true, name: true, subscriptionTier: true },
      });

      if (!company) {
        throw AppError.notFound('Company');
      }

      const existingUser = await tx.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          fullName: true,
          companyId: true,
          roleInCompany: true,
          passwordHash: true,
          oauthProvider: true,
          emailVerified: true,
          emailVerifiedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (existingUser?.companyId && existingUser.companyId !== companyId) {
        throw AppError.conflict('This user already belongs to another company');
      }

      if (
        existingUser &&
        (COMPANY_SUBCONTRACTOR_ROLES.has(existingUser.roleInCompany || '') ||
          (await tx.subcontractorUser.findFirst({
            where: {
              userId: existingUser.id,
              subcontractorCompany: { status: { not: 'removed' } },
            },
            select: { id: true },
          })))
      ) {
        throw AppError.forbidden(
          'Subcontractor portal accounts cannot be added as company members',
        );
      }

      if (existingUser?.roleInCompany === 'owner') {
        throw AppError.badRequest('Company owners are managed through ownership transfer');
      }

      // Role-rank rule: a non-owner admin cannot mint new admins or re-role an
      // existing admin via the invite path.
      assertActorMayManageCompanyMemberRole({
        actorRole: currentUser.roleInCompany,
        targetCurrentRole: existingUser?.roleInCompany,
        targetNewRole: roleInCompany,
      });

      const previousMemberState: CompanyMemberInvitationRollbackState | null = existingUser
        ? {
            id: existingUser.id,
            fullName: existingUser.fullName,
            companyId: existingUser.companyId,
            roleInCompany: existingUser.roleInCompany,
            emailVerified: existingUser.emailVerified,
            emailVerifiedAt: existingUser.emailVerifiedAt,
          }
        : null;
      const createdUser = !existingUser;
      const previousActiveSetupTokenIds = existingUser
        ? (
            await tx.passwordResetToken.findMany({
              where: {
                userId: existingUser.id,
                usedAt: null,
                expiresAt: { gt: new Date() },
              },
              select: { id: true },
            })
          ).map((token) => token.id)
        : [];

      const consumesSeat = !existingUser || existingUser.companyId !== companyId;
      // G1: seat-quota enforcement is disabled until a billing/upgrade path
      // exists, so the user ceiling cannot brick a company.
      if (TIER_QUOTA_ENFORCEMENT_ENABLED && consumesSeat) {
        const tier = normalizeSubscriptionTier(company.subscriptionTier);
        const userLimit = getUserLimitForTier(company.subscriptionTier);

        if (Number.isFinite(userLimit)) {
          const userCount = await tx.user.count({ where: { companyId } });
          if (userCount >= userLimit) {
            throw AppError.forbidden(
              `Your ${tier} subscription allows up to ${userLimit} users. Upgrade your plan or remove a member before inviting another user.`,
            );
          }
        }
      }

      const memberSelect = {
        id: true,
        email: true,
        fullName: true,
        roleInCompany: true,
        passwordHash: true,
        oauthProvider: true,
        createdAt: true,
        updatedAt: true,
      } satisfies Parameters<typeof tx.user.findUnique>[0]['select'];

      let member;
      if (existingUser) {
        const updated = await tx.user.updateMany({
          where: {
            id: existingUser.id,
            OR: [{ companyId: null }, { companyId }],
          },
          data: {
            companyId,
            roleInCompany,
            // Existing credentialed accounts keep their own emailVerified
            // state; only accounts onboarding via the setup link are verified.
            ...(shouldMarkInvitedMemberVerified(existingUser)
              ? { emailVerified: true, emailVerifiedAt: new Date() }
              : {}),
            ...(fullName !== undefined ? { fullName } : {}),
          },
        });

        if (updated.count !== 1) {
          throw AppError.conflict('This user already belongs to another company');
        }

        member = await tx.user.findUnique({
          where: { id: existingUser.id },
          select: memberSelect,
        });

        if (!member) {
          throw AppError.notFound('Company member');
        }
      } else {
        member = await tx.user.create({
          data: {
            email,
            fullName: fullName ?? null,
            companyId,
            roleInCompany,
            emailVerified: true,
            emailVerifiedAt: new Date(),
          },
          select: memberSelect,
        });
      }

      const setupRequired = !member.passwordHash && !member.oauthProvider;
      if (setupRequired) {
        await tx.passwordResetToken.updateMany({
          where: {
            userId: member.id,
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { usedAt: new Date() },
        });

        await tx.passwordResetToken.create({
          data: {
            userId: member.id,
            token: hashOneTimeToken(setupToken),
            expiresAt: setupExpiresAt,
          },
        });
      }

      return {
        company,
        member,
        setupRequired,
        createdUser,
        previousMemberState,
        previousActiveSetupTokenIds,
        notifyAttachedMember: shouldNotifyAttachedCompanyMember(existingUser, companyId),
      };
    });

    if (setupRequired) {
      const setupUrl = buildFrontendUrl(`/reset-password?token=${setupToken}`);
      let emailResult;
      try {
        emailResult = await sendCompanyMemberInvitationEmail({
          to: member.email,
          userName: member.fullName,
          companyName: company.name,
          inviterEmail: user.email,
          setupUrl,
          expiresInDays: COMPANY_MEMBER_INVITATION_EXPIRES_DAYS,
        });
      } catch (emailError) {
        logError('[Company Member Invite] Failed to send email:', emailError);
        await cleanupFailedCompanyMemberInvitation({
          memberId: member.id,
          setupToken,
          createdUser,
          previousMemberState,
          previousActiveSetupTokenIds,
        });
        throw createEmailDeliveryFailureError(
          {
            success: false,
            error:
              emailError instanceof Error ? emailError.message : 'Company invitation send failed',
          },
          COMPANY_MEMBER_INVITATION_EMAIL_FAILURE_COPY,
        );
      }

      if (!emailResult.success) {
        logError('[Company Member Invite] Failed to send email:', emailResult.error);
        await cleanupFailedCompanyMemberInvitation({
          memberId: member.id,
          setupToken,
          createdUser,
          previousMemberState,
          previousActiveSetupTokenIds,
        });
        throw createEmailDeliveryFailureError(
          emailResult,
          COMPANY_MEMBER_INVITATION_EMAIL_FAILURE_COPY,
        );
      }
    } else if (notifyAttachedMember) {
      // Existing credentialed account attached to the company without a setup
      // email — notify them so the membership change is never silent. Best-effort:
      // a delivery failure must not roll back the membership.
      try {
        await sendNotificationEmail(member.email, 'company_membership_added', {
          title: `You were added to ${company.name}`,
          message: `${user.email} added your SiteProof account to ${company.name} as a ${roleInCompany}. If you were not expecting this, contact ${user.email} or SiteProof support.`,
          userName: member.fullName ?? undefined,
          linkUrl: '/settings',
        });
      } catch (notifyError) {
        logError('[Company Member Invite] Failed to send membership notification:', notifyError);
      }
    }

    const roleChangedExistingCompanyMember =
      previousMemberState?.companyId === companyId &&
      previousMemberState.roleInCompany !== roleInCompany;

    await createAuditLog({
      userId: user.userId,
      entityType: 'user',
      entityId: member.id,
      action: roleChangedExistingCompanyMember
        ? AuditAction.USER_ROLE_CHANGED
        : AuditAction.USER_INVITED,
      changes: roleChangedExistingCompanyMember
        ? {
            memberId: member.id,
            memberEmail: member.email,
            companyId,
            source: 'company_member_invite',
            roleInCompany: {
              from: previousMemberState.roleInCompany,
              to: roleInCompany,
            },
          }
        : {
            invitedUserId: member.id,
            invitedUserEmail: member.email,
            roleInCompany,
            companyId,
            status: setupRequired ? 'pending' : 'active',
          },
      req,
    });

    res.status(201).json(
      buildCompanyMemberInvitedResponse(member, {
        expiresAt: setupRequired ? setupExpiresAt : null,
      }),
    );
  }),
);

// DELETE /api/company/members/:memberId - Remove a member or cancel a pending invite
companyMemberRoutes.delete(
  '/members/:memberId',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    requireBrowserSession(req, 'Company member removal');
    const companyId = requireCompanyAdmin(user);
    const memberId = normalizeCompanyString(req.params.memberId, 'Member ID', 128, {
      required: true,
    });

    if (!memberId) {
      throw AppError.badRequest('Member ID is required');
    }

    if (memberId === user.userId) {
      throw AppError.badRequest('Use leave company to remove your own company membership');
    }

    const removedAt = new Date();
    let removedProjectMembershipCount = 0;
    let cancelledSetupInviteCount = 0;
    let revokedApiKeyCount = 0;
    let removalStatus: 'removed' | 'cancelled' = 'removed';
    let targetEmail = '';
    let previousRole = '';

    await prisma.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({
        where: { id: user.userId },
        select: { companyId: true, roleInCompany: true },
      });

      if (currentUser?.companyId !== companyId) {
        throw AppError.forbidden('Invalid company session');
      }

      if (!['owner', 'admin'].includes(currentUser.roleInCompany || '')) {
        throw AppError.forbidden('Only company owners and admins can remove company members');
      }

      await tx.$queryRaw`
        SELECT id
        FROM companies
        WHERE id = ${companyId}
        FOR UPDATE
      `;

      const targetMember = await tx.user.findFirst({
        where: { id: memberId, companyId },
        select: {
          id: true,
          email: true,
          roleInCompany: true,
          passwordHash: true,
          oauthProvider: true,
        },
      });

      if (!targetMember) {
        throw AppError.notFound('Company member');
      }

      if (targetMember.roleInCompany === 'owner') {
        throw AppError.badRequest('Company owners must transfer ownership before being removed');
      }

      // Role-rank rule: only the owner may remove another admin.
      assertActorMayManageCompanyMemberRole({
        actorRole: currentUser.roleInCompany,
        targetCurrentRole: targetMember.roleInCompany,
      });

      previousRole = targetMember.roleInCompany;
      targetEmail = targetMember.email;

      await assertCanRemoveUserFromProjectAdminRoles(memberId, {
        companyId,
        actionDescription: 'remove company member',
        subjectDescription: 'they are',
        client: tx,
      });

      const companyProjects = await tx.project.findMany({
        where: { companyId },
        select: { id: true },
      });
      const projectIds = companyProjects.map((project) => project.id);

      const removedProjectMemberships = await tx.projectUser.deleteMany({
        where: {
          userId: memberId,
          projectId: { in: projectIds },
        },
      });
      removedProjectMembershipCount = removedProjectMemberships.count;

      const cancelledSetupTokens = await tx.passwordResetToken.updateMany({
        where: {
          userId: memberId,
          usedAt: null,
          expiresAt: { gt: removedAt },
        },
        data: { usedAt: removedAt },
      });
      cancelledSetupInviteCount = cancelledSetupTokens.count;

      if (!targetMember.passwordHash && !targetMember.oauthProvider) {
        removalStatus = 'cancelled';
        await tx.emailVerificationToken.deleteMany({ where: { userId: memberId } });
        // A pending-invite user is hard-deleted; ApiKey has onDelete: Cascade, so
        // any keys go with the row — no explicit revoke needed.
        await tx.user.delete({ where: { id: memberId } });
      } else {
        // M72(a): the user row is kept (only detached from the company), so revoke
        // their API keys — otherwise the keys stay active and keep authenticating
        // against the API after the member is removed.
        const revokedApiKeys = await tx.apiKey.updateMany({
          where: { userId: memberId, isActive: true },
          data: { isActive: false },
        });
        revokedApiKeyCount = revokedApiKeys.count;

        await tx.user.update({
          where: { id: memberId },
          data: {
            companyId: null,
            roleInCompany: 'member',
          },
        });
      }

      // M73: write the audit record inside the transaction so the removal
      // cannot persist without it (hard-fail).
      await writeAuditLogInTransaction(tx, {
        userId: user.userId,
        entityType: 'user',
        entityId: memberId,
        action: AuditAction.USER_REMOVED,
        changes: {
          removedUserId: memberId,
          removedUserEmail: targetEmail,
          companyId,
          previousRole,
          status: removalStatus,
          removedProjectMembershipCount,
          cancelledSetupInviteCount,
          // See the leave handler: keep this count out of the audit redactor.
          revokedKeyCount: revokedApiKeyCount,
        },
        req,
      });
    });

    res.json(buildCompanyMemberRemovedResponse({ memberId, status: removalStatus, removedAt }));
  }),
);

// H23: change a company member's role. Owner/admin only; the owner's role can
// only change through transfer-ownership, and an admin cannot change their own
// role here (mirrors the team UI, which hides the control for self and owner).
companyMemberRoutes.patch(
  '/members/:memberId',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    requireBrowserSession(req, 'Company member role change');
    const companyId = requireCompanyAdmin(user);
    const memberId = normalizeCompanyString(req.params.memberId, 'Member ID', 128, {
      required: true,
    });

    if (!memberId) {
      throw AppError.badRequest('Member ID is required');
    }

    if (memberId === user.userId) {
      throw AppError.badRequest('You cannot change your own company role');
    }

    const newRole = normalizeCompanyMemberRole(req.body?.roleInCompany);

    let previousRole = '';
    let targetEmail = '';

    await prisma.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({
        where: { id: user.userId },
        select: { companyId: true, roleInCompany: true },
      });

      if (currentUser?.companyId !== companyId) {
        throw AppError.forbidden('Invalid company session');
      }

      if (!['owner', 'admin'].includes(currentUser.roleInCompany || '')) {
        throw AppError.forbidden('Only company owners and admins can change member roles');
      }

      await tx.$queryRaw`
        SELECT id
        FROM companies
        WHERE id = ${companyId}
        FOR UPDATE
      `;

      const targetMember = await tx.user.findFirst({
        where: { id: memberId, companyId },
        select: { id: true, email: true, roleInCompany: true },
      });

      if (!targetMember) {
        throw AppError.notFound('Company member');
      }

      if (targetMember.roleInCompany === 'owner') {
        throw AppError.badRequest('Company owners must transfer ownership to change their role');
      }

      // Role-rank rule: only the owner may change another admin's role or grant
      // the admin role; admins may only manage members below the admin tier.
      assertActorMayManageCompanyMemberRole({
        actorRole: currentUser.roleInCompany,
        targetCurrentRole: targetMember.roleInCompany,
        targetNewRole: newRole,
      });

      previousRole = targetMember.roleInCompany;
      targetEmail = targetMember.email;

      if (previousRole === newRole) {
        // No-op: nothing to change, so skip the write and the audit record.
        return;
      }

      await tx.user.update({
        where: { id: memberId },
        data: { roleInCompany: newRole },
      });

      // M73: write the audit inside the transaction so a privileged role change
      // cannot persist without it (hard-fail).
      await writeAuditLogInTransaction(tx, {
        userId: user.userId,
        entityType: 'user',
        entityId: memberId,
        action: AuditAction.USER_ROLE_CHANGED,
        changes: {
          targetUserId: memberId,
          targetUserEmail: targetEmail,
          companyId,
          roleInCompany: { from: previousRole, to: newRole },
        },
        req,
      });
    });

    res.json(
      buildCompanyMemberRoleChangedResponse({ memberId, roleInCompany: newRole, previousRole }),
    );
  }),
);

// POST /api/company/transfer-ownership - Transfer company ownership to another user
companyMemberRoutes.post(
  '/transfer-ownership',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    requireBrowserSession(req, 'Ownership transfer');

    const newOwnerId = normalizeCompanyString(req.body.newOwnerId, 'New owner ID', 128, {
      required: true,
    });

    if (!newOwnerId) {
      throw AppError.badRequest('New owner ID is required');
    }

    if (!user.companyId) {
      throw AppError.notFound('Company');
    }
    const companyId = user.companyId;

    // Only owners can transfer ownership
    if (user.roleInCompany !== 'owner') {
      throw AppError.forbidden('Only the company owner can transfer ownership');
    }

    // Cannot transfer to yourself
    if (newOwnerId === user.userId) {
      throw AppError.badRequest('Cannot transfer ownership to yourself');
    }

    const { newOwner, transferredAt } = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id
        FROM companies
        WHERE id = ${user.companyId}
        FOR UPDATE
      `;

      const currentOwner = await tx.user.findFirst({
        where: {
          id: user.userId,
          companyId: user.companyId,
        },
        select: { id: true, roleInCompany: true },
      });

      if (!currentOwner) {
        throw AppError.forbidden('Invalid company session');
      }

      if (currentOwner.roleInCompany !== 'owner') {
        throw AppError.conflict('Company ownership has already changed. Refresh and try again.');
      }

      // Verify new owner is a member of the same company.
      const newOwner = await tx.user.findFirst({
        where: {
          id: newOwnerId,
          companyId: user.companyId,
        },
      });

      if (!newOwner) {
        throw AppError.notFound('User in your company');
      }

      if (!newOwner.passwordHash && !newOwner.oauthProvider) {
        throw AppError.badRequest(
          'New owner must have accepted their invitation before ownership can be transferred',
        );
      }

      const demoteResult = await tx.user.updateMany({
        where: {
          id: user.userId,
          companyId: user.companyId,
          roleInCompany: 'owner',
        },
        data: { roleInCompany: 'admin' },
      });

      if (demoteResult.count !== 1) {
        throw AppError.conflict('Company ownership has already changed. Refresh and try again.');
      }

      await tx.user.update({
        where: { id: newOwnerId },
        data: { roleInCompany: 'owner' },
      });

      // M73: write the audit record inside the transaction so ownership cannot
      // transfer without it (hard-fail).
      await writeAuditLogInTransaction(tx, {
        userId: user.userId,
        entityType: 'company',
        entityId: companyId,
        action: AuditAction.COMPANY_OWNERSHIP_TRANSFERRED,
        changes: {
          previousOwnerId: user.userId,
          newOwnerId,
          previousOwnerRole: { from: 'owner', to: 'admin' },
          newOwnerRole: { from: newOwner.roleInCompany, to: 'owner' },
        },
        req,
      });

      return { newOwner, transferredAt: new Date() };
    });

    res.json(buildCompanyOwnershipTransferredResponse(newOwner, transferredAt));
  }),
);

import { Router } from 'express';
import crypto from 'crypto';

import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { buildFrontendUrl } from '../../lib/runtimeConfig.js';
import { assertCanRemoveUserFromProjectAdminRoles } from '../../lib/projectAdminInvariant.js';
import { logError } from '../../lib/serverLogger.js';
import { AuditAction, createAuditLog } from '../../lib/auditLog.js';
import { sendCompanyMemberInvitationEmail } from '../../lib/email.js';
import { TIER_USER_LIMITS } from '../../lib/tierLimits.js';
import {
  buildCompanyLeftResponse,
  buildCompanyMemberInvitedResponse,
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
  COMPANY_SUBCONTRACTOR_ROLES,
  requireBrowserSession,
  requireCompanyAdmin,
} from './access.js';

const COMPANY_MEMBER_INVITATION_EXPIRES_DAYS = 7;
const ONE_TIME_TOKEN_HASH_PREFIX = 'sha256:';

export const companyMemberRoutes = Router();

function hashOneTimeToken(token: string): string {
  return `${ONE_TIME_TOKEN_HASH_PREFIX}${crypto.createHash('sha256').update(token).digest('hex')}`;
}

// POST /api/company/leave - Leave the current company
companyMemberRoutes.post(
  '/leave',
  asyncHandler(async (req, res) => {
    const user = req.user!;

    if (!user.companyId) {
      throw AppError.badRequest('You are not a member of any company');
    }

    // Don't allow owners to leave (they must transfer ownership or delete company)
    if (user.roleInCompany === 'owner') {
      throw AppError.forbidden(
        'Company owners cannot leave. Please transfer ownership first or delete the company.',
      );
    }

    const companyId = user.companyId;
    const previousRole = user.roleInCompany || null;
    let removedProjectMembershipCount = 0;
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

      // Remove company association from user using raw SQL to avoid Prisma quirks
      // Set role_in_company to 'member' (default) since it's NOT NULL
      await tx.$executeRaw`UPDATE users SET company_id = NULL, role_in_company = 'member' WHERE id = ${user.userId}`;
    });

    await createAuditLog({
      userId: user.userId,
      entityType: 'company',
      entityId: companyId,
      action: AuditAction.COMPANY_MEMBER_LEFT,
      changes: {
        memberUserId: user.userId,
        previousRole,
        removedProjectMembershipCount,
      },
      req,
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

    const { company, member, setupRequired } = await prisma.$transaction(async (tx) => {
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

      const consumesSeat = !existingUser || existingUser.companyId !== companyId;
      if (consumesSeat) {
        const tier = company.subscriptionTier || 'basic';
        const userLimit = TIER_USER_LIMITS[tier] ?? TIER_USER_LIMITS.basic;

        if (Number.isFinite(userLimit)) {
          const userCount = await tx.user.count({ where: { companyId } });
          if (userCount >= userLimit) {
            throw AppError.forbidden(
              `Your ${tier} subscription allows up to ${userLimit} users. Upgrade your plan or remove a member before inviting another user.`,
            );
          }
        }
      }

      const member = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              companyId,
              roleInCompany,
              emailVerified: true,
              emailVerifiedAt: existingUser.passwordHash ? existingUser.updatedAt : new Date(),
              ...(fullName !== undefined ? { fullName } : {}),
            },
            select: {
              id: true,
              email: true,
              fullName: true,
              roleInCompany: true,
              passwordHash: true,
              createdAt: true,
              updatedAt: true,
            },
          })
        : await tx.user.create({
            data: {
              email,
              fullName: fullName ?? null,
              companyId,
              roleInCompany,
              emailVerified: true,
              emailVerifiedAt: new Date(),
            },
            select: {
              id: true,
              email: true,
              fullName: true,
              roleInCompany: true,
              passwordHash: true,
              createdAt: true,
              updatedAt: true,
            },
          });

      const setupRequired = !member.passwordHash;
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

      return { company, member, setupRequired };
    });

    await createAuditLog({
      userId: user.userId,
      entityType: 'user',
      entityId: member.id,
      action: AuditAction.USER_INVITED,
      changes: {
        invitedUserId: member.id,
        invitedUserEmail: member.email,
        roleInCompany,
        companyId,
        status: setupRequired ? 'pending' : 'active',
      },
      req,
    });

    if (setupRequired) {
      const setupUrl = buildFrontendUrl(`/reset-password?token=${setupToken}`);
      try {
        await sendCompanyMemberInvitationEmail({
          to: member.email,
          userName: member.fullName,
          companyName: company.name,
          inviterEmail: user.email,
          setupUrl,
          expiresInDays: COMPANY_MEMBER_INVITATION_EXPIRES_DAYS,
        });
      } catch (emailError) {
        logError('[Company Member Invite] Failed to send email:', emailError);
      }
    }

    res.status(201).json(
      buildCompanyMemberInvitedResponse(member, {
        expiresAt: setupRequired ? setupExpiresAt : null,
      }),
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

    // Only owners can transfer ownership
    if (user.roleInCompany !== 'owner') {
      throw AppError.forbidden('Only the company owner can transfer ownership');
    }

    // Cannot transfer to yourself
    if (newOwnerId === user.userId) {
      throw AppError.badRequest('Cannot transfer ownership to yourself');
    }

    // Verify new owner is a member of the same company
    const newOwner = await prisma.user.findFirst({
      where: {
        id: newOwnerId,
        companyId: user.companyId,
      },
    });

    if (!newOwner) {
      throw AppError.notFound('User in your company');
    }

    // Transfer ownership: update both users in a transaction
    await prisma.$transaction([
      // Set new owner
      prisma.$executeRaw`UPDATE users SET role_in_company = 'owner' WHERE id = ${newOwnerId}`,
      // Demote current owner to admin
      prisma.$executeRaw`UPDATE users SET role_in_company = 'admin' WHERE id = ${user.userId}`,
    ]);

    await createAuditLog({
      userId: user.userId,
      entityType: 'company',
      entityId: user.companyId,
      action: AuditAction.COMPANY_OWNERSHIP_TRANSFERRED,
      changes: {
        previousOwnerId: user.userId,
        newOwnerId,
        previousOwnerRole: { from: 'owner', to: 'admin' },
        newOwnerRole: { from: newOwner.roleInCompany, to: 'owner' },
      },
      req,
    });

    res.json(buildCompanyOwnershipTransferredResponse(newOwner, new Date()));
  }),
);

import { Router, type Request } from 'express';
import type { PrismaClient } from '@prisma/client';

import { generateToken, hashPassword } from '../../lib/auth.js';
import { AuditAction, createAuditLog } from '../../lib/auditLog.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { sendVerificationEmail } from '../../lib/email.js';
import { buildFrontendUrl } from '../../lib/runtimeConfig.js';
import { logError } from '../../lib/serverLogger.js';
import {
  hashSubcontractorInvitationToken,
  isSubcontractorInvitationAcceptableStatus,
  isSubcontractorInvitationExpired,
  normalizeSubcontractorInvitationToken,
} from '../../lib/subcontractorInvitations.js';

type PasswordValidation = {
  valid: boolean;
  errors: string[];
};

type NormalizeProfileText = (
  value: unknown,
  fieldName: string,
  maxLength: number,
) => string | null | undefined;

type CreateRegistrationRouterDependencies = {
  prisma: PrismaClient;
  normalizeEmailInput: (value: unknown) => string;
  normalizePasswordInput: (value: unknown, fieldName?: string) => string;
  normalizeProfileText: NormalizeProfileText;
  hashOneTimeToken: (token: string) => string;
  validatePassword: (password: string) => PasswordValidation;
  auditUserAuthEvent: (
    req: Request,
    userId: string,
    action: string,
    changes: Record<string, unknown>,
  ) => Promise<void>;
  profileFullNameMaxLength: number;
};

const CURRENT_TOS_VERSION = '1.0';
const VERIFICATION_BYPASS_EMAIL_DOMAINS_ENV = 'VERIFICATION_BYPASS_EMAIL_DOMAINS';

function getEmailDomain(email: string): string | null {
  const atIndex = email.lastIndexOf('@');
  if (atIndex === -1 || atIndex === email.length - 1) {
    return null;
  }
  return email
    .slice(atIndex + 1)
    .trim()
    .toLowerCase();
}

function getVerificationBypassDomains(): Set<string> {
  const rawValue = process.env[VERIFICATION_BYPASS_EMAIL_DOMAINS_ENV];
  if (!rawValue) {
    return new Set();
  }

  return new Set(
    rawValue
      .split(',')
      .map((domain) => domain.trim().toLowerCase().replace(/^@/, ''))
      .filter((domain) => domain && !domain.includes('*') && domain.includes('.')),
  );
}

function shouldBypassEmailVerification(email: string): { bypass: boolean; domain: string | null } {
  const domain = getEmailDomain(email);
  if (!domain) {
    return { bypass: false, domain: null };
  }

  return {
    bypass: getVerificationBypassDomains().has(domain),
    domain,
  };
}

function normalizeSubcontractorInvitationId(value: unknown): string {
  try {
    return normalizeSubcontractorInvitationToken(value);
  } catch {
    throw AppError.notFound('Invitation');
  }
}

function buildRegistrationDisplayName(
  fullName: unknown,
  firstName: unknown,
  lastName: unknown,
): string | null {
  const rawName =
    fullName ||
    (firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || null);

  return typeof rawName === 'string' ? rawName : null;
}

function buildRegistrationSuccessMessage(
  verificationBypass: { bypass: boolean },
  verificationEmailSent: boolean,
): string {
  if (verificationBypass.bypass) {
    return 'Account created. Email verified for this configured demo domain.';
  }

  if (verificationEmailSent) {
    return 'Account created. Please check your email to verify your account.';
  }

  return 'Account created, but the verification email could not be sent. Use resend verification to request a new link.';
}

async function sendRegistrationVerificationEmailOrRetireToken({
  prisma,
  emailVerificationTokenId,
  normalizedEmail,
  name,
  verifyUrl,
}: {
  prisma: PrismaClient;
  emailVerificationTokenId: string;
  normalizedEmail: string;
  name: string | null;
  verifyUrl: string;
}): Promise<boolean> {
  let verificationEmailSent = true;

  try {
    const emailResult = await sendVerificationEmail({
      to: normalizedEmail,
      userName: name || undefined,
      verificationUrl: verifyUrl,
      expiresInHours: 24,
    });

    if (!emailResult.success) {
      verificationEmailSent = false;
      logError('[Registration] Failed to send verification email:', emailResult.error);
    }
  } catch (emailError) {
    verificationEmailSent = false;
    logError('[Registration] Failed to send verification email:', emailError);
  }

  if (!verificationEmailSent) {
    await prisma.emailVerificationToken.updateMany({
      where: { id: emailVerificationTokenId, usedAt: null },
      data: { usedAt: new Date() },
    });
  }

  return verificationEmailSent;
}

export function createRegistrationRouter({
  prisma,
  normalizeEmailInput,
  normalizePasswordInput,
  normalizeProfileText,
  hashOneTimeToken,
  validatePassword,
  auditUserAuthEvent,
  profileFullNameMaxLength,
}: CreateRegistrationRouterDependencies) {
  const registrationRouter = Router();

  // POST /api/auth/register
  registrationRouter.post(
    '/register',
    asyncHandler(async (req, res) => {
      const { email, password, fullName, firstName, lastName, tosAccepted } = req.body;

      if (!email || !password) {
        throw AppError.badRequest('Email and password are required');
      }
      const normalizedEmail = normalizeEmailInput(email);
      const normalizedPassword = normalizePasswordInput(password);

      // Validate password strength
      const passwordValidation = validatePassword(normalizedPassword);
      if (!passwordValidation.valid) {
        throw AppError.badRequest('Password does not meet security requirements', {
          errors: passwordValidation.errors as unknown as Record<string, unknown>,
        });
      }

      // Require ToS acceptance
      if (!tosAccepted) {
        throw AppError.badRequest('You must accept the Terms of Service to create an account');
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        throw AppError.badRequest('Email already in use');
      }

      const name = buildRegistrationDisplayName(fullName, firstName, lastName);
      const verificationBypass = shouldBypassEmailVerification(normalizedEmail);
      const emailVerifiedAt = verificationBypass.bypass ? new Date() : null;

      // Create user with email verification state and ToS acceptance recorded.
      const passwordHash = hashPassword(normalizedPassword);
      const user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          fullName: name,
          emailVerified: verificationBypass.bypass,
          emailVerifiedAt,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          roleInCompany: true,
          emailVerified: true,
        },
      });

      // Record ToS acceptance using parameterized query
      // Use PostgreSQL NOW() function for timestamp compatibility
      await prisma.$executeRaw`UPDATE users SET tos_accepted_at = NOW(), tos_version = ${CURRENT_TOS_VERSION} WHERE id = ${user.id}`;

      let verificationEmailSent = verificationBypass.bypass;

      if (!verificationBypass.bypass) {
        // Generate email verification token
        const crypto = await import('crypto');
        const verificationToken = crypto.randomBytes(32).toString('hex');

        // Token expires in 24 hours
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const emailVerificationToken = await prisma.emailVerificationToken.create({
          data: {
            userId: user.id,
            token: hashOneTimeToken(verificationToken),
            expiresAt,
          },
        });

        const verifyUrl = buildFrontendUrl(`/verify-email?token=${verificationToken}`);

        verificationEmailSent = await sendRegistrationVerificationEmailOrRetireToken({
          prisma,
          emailVerificationTokenId: emailVerificationToken.id,
          normalizedEmail,
          name,
          verifyUrl,
        });
      }

      await auditUserAuthEvent(req, user.id, AuditAction.USER_REGISTERED, {
        emailVerified: { from: null, to: user.emailVerified },
        tosVersion: CURRENT_TOS_VERSION,
        ...(verificationBypass.bypass && {
          method: 'domain_allowlist',
          domain: verificationBypass.domain,
        }),
      });

      if (verificationBypass.bypass) {
        await auditUserAuthEvent(req, user.id, AuditAction.USER_EMAIL_VERIFIED, {
          emailVerified: { from: false, to: true },
          method: 'domain_allowlist',
          domain: verificationBypass.domain,
        });
      }

      // Generate auth token
      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.roleInCompany,
      });

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.roleInCompany,
          emailVerified: user.emailVerified,
          hasPassword: true,
        },
        token,
        message: buildRegistrationSuccessMessage(verificationBypass, verificationEmailSent),
        verificationRequired: !verificationBypass.bypass,
        verificationEmailSent,
      });
    }),
  );

  // POST /api/auth/register-and-accept-invitation - Register new user and accept subcontractor invitation
  // This is a public endpoint (no auth required) for onboarding new subcontractor users
  registrationRouter.post(
    '/register-and-accept-invitation',
    asyncHandler(async (req, res) => {
      const { email, password, fullName, invitationId, tosAccepted } = req.body;

      if (!email || !password || !invitationId) {
        throw AppError.badRequest('Email, password, and invitationId are required');
      }
      const normalizedEmail = normalizeEmailInput(email);
      const normalizedPassword = normalizePasswordInput(password);
      const normalizedInvitationId = normalizeSubcontractorInvitationId(invitationId);
      const invitationTokenHash = hashSubcontractorInvitationToken(normalizedInvitationId);
      const normalizedFullName = normalizeProfileText(
        fullName,
        'Full name',
        profileFullNameMaxLength,
      );

      // Validate password strength
      const passwordValidation = validatePassword(normalizedPassword);
      if (!passwordValidation.valid) {
        throw AppError.badRequest('Password does not meet security requirements', {
          errors: passwordValidation.errors as unknown as Record<string, unknown>,
        });
      }

      // Require ToS acceptance
      if (!tosAccepted) {
        throw AppError.badRequest('You must accept the Terms of Service to create an account');
      }

      const passwordHash = hashPassword(normalizedPassword);
      const { user, subcontractor } = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id
          FROM subcontractor_companies
          WHERE invitation_token_hash = ${invitationTokenHash}
          FOR UPDATE
        `;

        const invitedSubcontractor = await tx.subcontractorCompany.findUnique({
          where: { invitationTokenHash },
          include: {
            project: { select: { id: true, name: true } },
          },
        });

        if (!invitedSubcontractor) {
          throw AppError.notFound('Invitation');
        }

        if (isSubcontractorInvitationExpired(invitedSubcontractor)) {
          throw AppError.notFound('Invitation');
        }

        if (!isSubcontractorInvitationAcceptableStatus(invitedSubcontractor.status)) {
          throw AppError.forbidden('This invitation is no longer active');
        }

        if (invitedSubcontractor.primaryContactEmail?.trim().toLowerCase() !== normalizedEmail) {
          throw AppError.badRequest('Email does not match the invitation');
        }

        const existingUser = await tx.user.findUnique({
          where: { email: normalizedEmail },
        });

        if (existingUser) {
          throw AppError.badRequest(
            'An account with this email already exists. Please log in and accept the invitation.',
          );
        }

        const existingLink = await tx.subcontractorUser.findFirst({
          where: { subcontractorCompanyId: invitedSubcontractor.id },
        });

        if (existingLink) {
          throw AppError.badRequest('This invitation has already been accepted by another user');
        }

        if (invitedSubcontractor.status === 'pending_approval') {
          const statusUpdate = await tx.subcontractorCompany.updateMany({
            where: { id: invitedSubcontractor.id, status: 'pending_approval' },
            data: { status: 'approved' },
          });

          if (statusUpdate.count !== 1) {
            throw AppError.badRequest('This invitation has already been accepted by another user');
          }
        }

        const createdUser = await tx.user.create({
          data: {
            email: normalizedEmail,
            passwordHash,
            fullName: normalizedFullName ?? invitedSubcontractor.primaryContactName ?? null,
            emailVerified: true, // Auto-verify since they're accepting an invitation
            emailVerifiedAt: new Date(),
            roleInCompany: 'subcontractor_admin',
            tosAcceptedAt: new Date(),
            tosVersion: CURRENT_TOS_VERSION,
          },
          select: {
            id: true,
            email: true,
            fullName: true,
            roleInCompany: true,
          },
        });

        await tx.subcontractorUser.create({
          data: {
            userId: createdUser.id,
            subcontractorCompanyId: invitedSubcontractor.id,
            role: 'admin', // First user is admin
          },
        });

        return { user: createdUser, subcontractor: invitedSubcontractor };
      });

      // Generate auth token
      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.roleInCompany,
      });

      await createAuditLog({
        projectId: subcontractor.project.id,
        userId: user.id,
        entityType: 'subcontractor',
        entityId: subcontractor.id,
        action: AuditAction.SUBCONTRACTOR_INVITATION_ACCEPTED,
        changes: {
          companyName: subcontractor.companyName,
          acceptedEmail: user.email,
          createdAccount: true,
        },
        req,
      });

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.roleInCompany,
          roleInCompany: user.roleInCompany,
          companyId: null,
          hasSubcontractorPortalAccess: true,
          hasPassword: true,
        },
        company: {
          id: subcontractor.id,
          companyName: subcontractor.companyName,
          projectId: subcontractor.projectId,
          projectName: subcontractor.project.name,
        },
        token,
        message: 'Account created and invitation accepted successfully',
      });
    }),
  );

  return registrationRouter;
}

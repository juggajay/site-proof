import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { type HPProjectSettings, requiresSuperintendentApproval } from './validation.js';

/**
 * Hold-point superintendent release-recipient helpers, extracted verbatim from
 * backend/src/routes/holdpoints.ts as a slice of the holdpoints route split
 * (engineering-health Workstream 1).
 *
 * When a project requires superintendent approval to release a hold point, the
 * release notification may only go to people who are actually eligible
 * superintendents (project users in an eligible role, plus the owning company's
 * owners/admins). `getEligibleSuperintendentReleaseRecipients` builds that
 * eligible set keyed by lower-cased email (deduping project users and company
 * admins), and `requireSuperintendentApprovalRecipients` filters the requested
 * recipients down to that set — rejecting the request with a 403 if any
 * requested recipient is not eligible. Behaviour — the Prisma selects, the
 * dedupe-by-lowercase-email, the AppError.notFound('Project') / forbidden
 * message, and the requiresSuperintendentApproval short-circuit — is preserved
 * exactly as it was inline in the route file. The recipient-resolution logic is
 * unit-tested in superintendentRecipients.test.ts; the DB-backed eligibility
 * query stays covered by the route/integration tests.
 */

export const HP_SUPERINTENDENT_RELEASE_ROLES = [
  'owner',
  'admin',
  'project_manager',
  'superintendent',
];

export type HoldPointNotificationRecipient = {
  email: string;
  fullName: string | null;
};

export async function getEligibleSuperintendentReleaseRecipients(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { companyId: true },
  });

  if (!project) {
    throw AppError.notFound('Project');
  }

  const [projectUsers, companyAdmins] = await Promise.all([
    prisma.projectUser.findMany({
      where: {
        projectId,
        status: 'active',
        role: { in: HP_SUPERINTENDENT_RELEASE_ROLES },
      },
      include: {
        user: { select: { email: true, fullName: true } },
      },
    }),
    prisma.user.findMany({
      where: {
        companyId: project.companyId,
        roleInCompany: { in: ['owner', 'admin'] },
      },
      select: { email: true, fullName: true },
    }),
  ]);

  const eligibleByEmail = new Map<string, HoldPointNotificationRecipient>();

  for (const projectUser of projectUsers) {
    eligibleByEmail.set(projectUser.user.email.toLowerCase(), {
      email: projectUser.user.email,
      fullName: projectUser.user.fullName,
    });
  }

  for (const companyAdmin of companyAdmins) {
    eligibleByEmail.set(companyAdmin.email.toLowerCase(), {
      email: companyAdmin.email,
      fullName: companyAdmin.fullName,
    });
  }

  return eligibleByEmail;
}

export async function requireSuperintendentApprovalRecipients(
  projectId: string,
  settings: HPProjectSettings,
  recipients: HoldPointNotificationRecipient[],
): Promise<HoldPointNotificationRecipient[]> {
  if (!requiresSuperintendentApproval(settings) || recipients.length === 0) {
    return recipients;
  }

  const eligibleByEmail = await getEligibleSuperintendentReleaseRecipients(projectId);

  const resolvedRecipients = recipients.map((recipient) => {
    const eligibleRecipient = eligibleByEmail.get(recipient.email.trim().toLowerCase());
    if (!eligibleRecipient) {
      throw AppError.forbidden(
        'This project requires superintendent approval to release hold points.',
      );
    }

    return eligibleRecipient;
  });

  return resolvedRecipients;
}

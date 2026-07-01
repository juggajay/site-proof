import { AppError } from '../../lib/AppError.js';
import {
  TIER_QUOTA_ENFORCEMENT_ENABLED,
  getProjectLimitForTier,
  normalizeSubscriptionTier,
} from '../../lib/tierLimits.js';

export type ProjectCreationLimitClient = {
  $queryRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
  company: {
    findUnique: (args: {
      where: { id: string };
      select: { subscriptionTier: true };
    }) => Promise<{ subscriptionTier: string | null } | null>;
  };
  project: {
    count: (args: { where: { companyId: string; status: { not: string } } }) => Promise<number>;
  };
};

export async function assertCompanyProjectCapacity(
  client: ProjectCreationLimitClient,
  companyId: string,
): Promise<void> {
  await client.$queryRaw`
    SELECT id
    FROM companies
    WHERE id = ${companyId}
    FOR UPDATE
  `;

  const company = await client.company.findUnique({
    where: { id: companyId },
    select: { subscriptionTier: true },
  });

  if (!company) {
    throw AppError.notFound('Company');
  }

  const tier = normalizeSubscriptionTier(company.subscriptionTier);
  const limit = getProjectLimitForTier(company.subscriptionTier);

  if (limit === Infinity) {
    return;
  }

  const projectCount = await client.project.count({
    where: { companyId, status: { not: 'archived' } },
  });

  // G1: quota enforcement is disabled until a billing/upgrade path exists, so
  // the ceiling cannot brick a company. The count above is retained so this
  // becomes enforcing again the moment TIER_QUOTA_ENFORCEMENT_ENABLED is set.
  if (TIER_QUOTA_ENFORCEMENT_ENABLED && projectCount >= limit) {
    throw AppError.forbidden(
      `Your ${tier} subscription allows up to ${limit} projects. Please upgrade to create more projects.`,
    );
  }
}

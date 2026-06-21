import { AppError } from '../../lib/AppError.js';
import { TIER_PROJECT_LIMITS } from '../../lib/tierLimits.js';

export type ProjectCreationLimitClient = {
  $queryRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
  company: {
    findUnique: (args: {
      where: { id: string };
      select: { subscriptionTier: true };
    }) => Promise<{ subscriptionTier: string | null } | null>;
  };
  project: {
    count: (args: { where: { companyId: string } }) => Promise<number>;
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

  const tier = company.subscriptionTier || 'basic';
  const limit = TIER_PROJECT_LIMITS[tier] || TIER_PROJECT_LIMITS.basic;

  if (limit === Infinity) {
    return;
  }

  const projectCount = await client.project.count({
    where: { companyId },
  });

  if (projectCount >= limit) {
    throw AppError.forbidden(
      `Your ${tier} subscription allows up to ${limit} projects. Please upgrade to create more projects.`,
    );
  }
}

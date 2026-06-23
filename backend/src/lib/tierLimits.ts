/**
 * Subscription tier limits for projects and users.
 * Shared across routes that enforce tier-based quotas.
 */

/**
 * G1: tier-quota enforcement is turned OFF until a billing/upgrade path
 * exists. The basic 3-project / 5-user ceilings would otherwise permanently
 * brick companies with no way to pay for more capacity. The nominal limits
 * below are still surfaced for display; only the blocking checks are gated on
 * this flag. Flip this to `true` (or replace with a billing-aware check) once
 * an upgrade mechanism ships.
 */
export const TIER_QUOTA_ENFORCEMENT_ENABLED: boolean = false;

export const TIER_PROJECT_LIMITS: Record<string, number> = {
  basic: 3,
  professional: 10,
  enterprise: 50,
  unlimited: Infinity,
};

export const TIER_USER_LIMITS: Record<string, number> = {
  basic: 5,
  professional: 25,
  enterprise: 100,
  unlimited: Infinity,
};

export type SubscriptionTier = keyof typeof TIER_PROJECT_LIMITS;

const DEFAULT_SUBSCRIPTION_TIER: SubscriptionTier = 'basic';
const SUBSCRIPTION_TIERS = new Set<SubscriptionTier>(
  Object.keys(TIER_PROJECT_LIMITS) as SubscriptionTier[],
);

export function normalizeSubscriptionTier(value: string | null | undefined): SubscriptionTier {
  const normalized = value?.trim().toLowerCase();
  if (normalized && SUBSCRIPTION_TIERS.has(normalized as SubscriptionTier)) {
    return normalized as SubscriptionTier;
  }
  return DEFAULT_SUBSCRIPTION_TIER;
}

export function getProjectLimitForTier(value: string | null | undefined): number {
  return TIER_PROJECT_LIMITS[normalizeSubscriptionTier(value)];
}

export function getUserLimitForTier(value: string | null | undefined): number {
  return TIER_USER_LIMITS[normalizeSubscriptionTier(value)];
}

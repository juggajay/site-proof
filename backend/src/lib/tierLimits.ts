/**
 * Subscription tier limits for projects and users.
 * Shared across routes that enforce tier-based quotas.
 */

export const TIER_PROJECT_LIMITS: Record<string, number> = {
  basic: 3,
  professional: 10,
  enterprise: 50,
  unlimited: Infinity,
}

export const TIER_USER_LIMITS: Record<string, number> = {
  basic: 5,
  professional: 25,
  enterprise: 100,
  unlimited: Infinity,
}

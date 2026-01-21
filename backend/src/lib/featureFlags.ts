// Feature Flags Module for Security Enhancements
// Controls feature toggles for gradual rollout of security improvements

export const FEATURE_FLAGS = {
  FORCE_PASSWORD_REHASH: process.env.FORCE_PASSWORD_REHASH === 'true',
  ENCRYPT_2FA_SECRETS: process.env.ENCRYPT_2FA_SECRETS !== 'false', // default ON
  STRICT_RATE_LIMITING: process.env.STRICT_RATE_LIMITING !== 'false', // default ON
} as const

export type FeatureFlag = keyof typeof FEATURE_FLAGS

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag]
}

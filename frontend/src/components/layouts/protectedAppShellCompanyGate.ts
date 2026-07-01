const COMPANY_ONBOARDING_BYPASS_PATHS = new Set([
  '/settings',
  '/profile',
  '/support',
  '/docs',
  '/documentation',
]);

export function canBypassCompanyOnboardingGate(pathname: string): boolean {
  return COMPANY_ONBOARDING_BYPASS_PATHS.has(pathname);
}

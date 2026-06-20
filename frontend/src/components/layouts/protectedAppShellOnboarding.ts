const GENERAL_ONBOARDING_AUTO_SHOW_ROUTES = new Set(['/dashboard', '/projects', '/portfolio']);

export function shouldAutoShowGeneralOnboardingForPath(pathname: string): boolean {
  return GENERAL_ONBOARDING_AUTO_SHOW_ROUTES.has(pathname);
}

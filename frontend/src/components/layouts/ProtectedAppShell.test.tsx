import { describe, expect, it } from 'vitest';

import { shouldAutoShowGeneralOnboardingForPath } from './protectedAppShellOnboarding';

describe('ProtectedAppShell onboarding auto-show route gate', () => {
  it.each(['/dashboard', '/projects', '/portfolio'])(
    'allows first-run auto-show on %s',
    (pathname) => {
      expect(shouldAutoShowGeneralOnboardingForPath(pathname)).toBe(true);
    },
  );

  it.each([
    '/projects/project-1',
    '/projects/project-1/documents',
    '/projects/project-1/lots',
    '/company-settings',
    '/onboarding',
  ])('suppresses first-run auto-show on deep or setup route %s', (pathname) => {
    expect(shouldAutoShowGeneralOnboardingForPath(pathname)).toBe(false);
  });
});

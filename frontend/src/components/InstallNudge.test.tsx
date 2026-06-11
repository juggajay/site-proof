// Tests for InstallNudge component.
//
// Covers:
//   - installed state → renders nothing
//   - ios-manual state → rendered with 3 illustrated steps, no Install button
//   - chromium state → rendered with Install button, no step list
//   - dismissed recently → renders nothing
//   - first session (open-count 0) → renders nothing
//   - dismiss button calls writeInstallNudgeDismissedAt and hides the nudge
//   - all roles → renders (nudge available to any authenticated user on mobile)
//   - desktop viewport → renders nothing

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// ── hoisted mocks ────────────────────────────────────────────────────────────

const { pwaInstallState, canPromptInstall, promptInstall } = vi.hoisted(() => ({
  pwaInstallState: { current: 'unsupported' as import('@/hooks/usePwaInstall').PwaInstallState },
  canPromptInstall: { current: false },
  promptInstall: vi.fn().mockResolvedValue('accepted'),
}));

const { isMobileValue } = vi.hoisted(() => ({
  isMobileValue: { current: true },
}));

const { openCount, dismissedAt, incrementFn, writeDismissedAtFn } = vi.hoisted(() => ({
  openCount: { current: 0 },
  dismissedAt: { current: null as number | null },
  incrementFn: vi.fn(),
  writeDismissedAtFn: vi.fn(),
}));

const { userRole } = vi.hoisted(() => ({
  userRole: { current: 'foreman' as string | undefined },
}));

vi.mock('@/hooks/usePwaInstall', () => ({
  usePwaInstall: () => ({
    state: pwaInstallState.current,
    canPromptInstall: canPromptInstall.current,
    promptInstall,
  }),
}));

vi.mock('@/hooks/useMediaQuery', () => ({
  useIsMobile: () => isMobileValue.current,
}));

vi.mock('@/lib/storagePreferences', () => ({
  readInstallNudgeOpenCount: () => openCount.current,
  incrementInstallNudgeOpenCount: incrementFn,
  readInstallNudgeDismissedAt: () => dismissedAt.current,
  writeInstallNudgeDismissedAt: writeDismissedAtFn,
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { role: userRole.current } }),
}));

// ── import after mocks ───────────────────────────────────────────────────────

import { InstallNudge } from './InstallNudge';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Re-declare to satisfy TypeScript — only used in the mock type annotation. */
type UsePwaInstallStateExport = 'installed' | 'chromium' | 'ios-manual' | 'unsupported';
// Suppress the unused-type lint warning in the hoisted block above.
void (null as unknown as UsePwaInstallStateExport);

function setupEngagedSession() {
  openCount.current = 2; // second session
  dismissedAt.current = null;
  isMobileValue.current = true;
  userRole.current = 'foreman';
}

// ── tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  openCount.current = 0;
  dismissedAt.current = null;
  isMobileValue.current = true;
  userRole.current = 'foreman';
  pwaInstallState.current = 'unsupported';
  canPromptInstall.current = false;
  promptInstall.mockResolvedValue('accepted');
});

describe('InstallNudge', () => {
  describe('installed state', () => {
    it('renders nothing when app is already installed', () => {
      setupEngagedSession();
      pwaInstallState.current = 'installed';

      const { container } = render(<InstallNudge />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('unsupported state', () => {
    it('renders nothing when platform is unsupported', () => {
      setupEngagedSession();
      pwaInstallState.current = 'unsupported';

      const { container } = render(<InstallNudge />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('first session (open-count < 2)', () => {
    it('renders nothing when open-count is 0 (first session)', () => {
      openCount.current = 0;
      isMobileValue.current = true;
      userRole.current = 'foreman';
      pwaInstallState.current = 'ios-manual';

      const { container } = render(<InstallNudge />);
      expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing when open-count is 1', () => {
      openCount.current = 1;
      isMobileValue.current = true;
      userRole.current = 'foreman';
      pwaInstallState.current = 'ios-manual';

      const { container } = render(<InstallNudge />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('dismissed recently', () => {
    it('renders nothing when dismissed less than 14 days ago', () => {
      setupEngagedSession();
      pwaInstallState.current = 'ios-manual';
      // Dismissed 1 day ago
      dismissedAt.current = Date.now() - 1 * 24 * 60 * 60 * 1000;

      const { container } = render(<InstallNudge />);
      expect(container).toBeEmptyDOMElement();
    });

    it('renders when dismissed more than 14 days ago', () => {
      setupEngagedSession();
      pwaInstallState.current = 'ios-manual';
      // Dismissed 15 days ago
      dismissedAt.current = Date.now() - 15 * 24 * 60 * 60 * 1000;

      render(<InstallNudge />);
      expect(screen.getByRole('complementary')).toBeInTheDocument();
    });
  });

  describe('all roles', () => {
    it.each([
      'owner',
      'admin',
      'project_manager',
      'quality_manager',
      'foreman',
      'site_manager',
      'subcontractor',
    ])('renders for %s role on mobile when conditions are met', (role) => {
      setupEngagedSession();
      pwaInstallState.current = 'ios-manual';
      userRole.current = role;

      render(<InstallNudge />);
      expect(screen.getByRole('complementary')).toBeInTheDocument();
    });
  });

  describe('desktop viewport', () => {
    it('renders nothing on desktop (isMobile = false)', () => {
      setupEngagedSession();
      isMobileValue.current = false;
      pwaInstallState.current = 'ios-manual';

      const { container } = render(<InstallNudge />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('ios-manual state', () => {
    it('renders the 3-step illustrated instructions', () => {
      setupEngagedSession();
      pwaInstallState.current = 'ios-manual';

      render(<InstallNudge />);

      expect(screen.getByRole('list', { name: /steps to install on ios/i })).toBeInTheDocument();
      expect(screen.getByText(/Share/i)).toBeInTheDocument();
      expect(screen.getByText(/Add to Home Screen/i)).toBeInTheDocument();
      // "Tap Add to confirm" is split across text nodes and a <strong> — match
      // the containing <span> by querying for the partial text within it.
      expect(
        screen.getByText((_, el) => {
          return el?.tagName === 'SPAN' && /tap.*add.*to confirm/i.test(el.textContent ?? '');
        }),
      ).toBeInTheDocument();
      // No install button on iOS
      expect(screen.queryByRole('button', { name: /^Install$/i })).not.toBeInTheDocument();
    });

    it('shows the headline copy', () => {
      setupEngagedSession();
      pwaInstallState.current = 'ios-manual';

      render(<InstallNudge />);
      expect(screen.getByText(/Install SiteProof for offline mode/i)).toBeInTheDocument();
    });
  });

  describe('chromium state', () => {
    it('renders the Install button', () => {
      setupEngagedSession();
      pwaInstallState.current = 'chromium';
      canPromptInstall.current = true;

      render(<InstallNudge />);
      expect(screen.getByRole('button', { name: /^Install$/i })).toBeInTheDocument();
      // No iOS step list
      expect(
        screen.queryByRole('list', { name: /steps to install on ios/i }),
      ).not.toBeInTheDocument();
    });

    it('Install button is disabled when canPromptInstall is false', () => {
      setupEngagedSession();
      pwaInstallState.current = 'chromium';
      canPromptInstall.current = false;

      render(<InstallNudge />);
      expect(screen.getByRole('button', { name: /^Install$/i })).toBeDisabled();
    });

    it('calls promptInstall on Install button click', async () => {
      setupEngagedSession();
      pwaInstallState.current = 'chromium';
      canPromptInstall.current = true;

      render(<InstallNudge />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^Install$/i }));
      });
      expect(promptInstall).toHaveBeenCalledTimes(1);
    });
  });

  describe('dismiss', () => {
    it('hides the nudge when the dismiss button is clicked', async () => {
      setupEngagedSession();
      pwaInstallState.current = 'ios-manual';

      render(<InstallNudge />);
      expect(screen.getByRole('complementary')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /dismiss install prompt/i }));
      });

      expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    });

    it('calls writeInstallNudgeDismissedAt on dismiss', async () => {
      setupEngagedSession();
      pwaInstallState.current = 'ios-manual';

      render(<InstallNudge />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /dismiss install prompt/i }));
      });

      expect(writeDismissedAtFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('open count increment', () => {
    it('calls incrementInstallNudgeOpenCount on mount', () => {
      pwaInstallState.current = 'ios-manual';
      render(<InstallNudge />);
      expect(incrementFn).toHaveBeenCalledTimes(1);
    });
  });
});

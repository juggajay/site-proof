// The product tour must auto-show AT MOST once per user per device: the seen
// marker is persisted the moment the tour opens (not only on dismissal), so
// reloads, remounts, and auth refreshes can never re-trigger it — the
// recurring-launch-modal bug that originally got the tour hardcoded off in
// PR #203. Replay is explicit, via startOnboardingTour() from the header.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';

vi.mock('@/lib/auth', () => ({ useAuth: vi.fn() }));

import { OnboardingTour, onboardingStorageKey, startOnboardingTour } from './OnboardingTour';
import { useAuth } from '@/lib/auth';

const useAuthMock = vi.mocked(useAuth);

const PM_USER = {
  id: 'user-pm',
  role: 'project_manager',
  roleInCompany: 'project_manager',
  companyId: 'company-1',
};

const FOREMAN_USER = {
  id: 'user-foreman',
  role: 'foreman',
  roleInCompany: 'foreman',
  companyId: 'company-1',
};

const TOUR_HEADING = 'Welcome to SiteProof!';

function mockUser(user: Record<string, unknown>) {
  useAuthMock.mockReturnValue({ user } as unknown as ReturnType<typeof useAuth>);
}

function renderTour(props: ComponentProps<typeof OnboardingTour> = {}) {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <OnboardingTour {...props} />
    </MemoryRouter>,
  );
}

function advancePastAutoShowDelay() {
  act(() => {
    vi.advanceTimersByTime(600);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  mockUser(PM_USER);
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('OnboardingTour first-run auto-show', () => {
  it('auto-shows once on a fresh device and persists the per-user seen marker on open', () => {
    renderTour();

    // Not shown synchronously — the page gets a beat to render first.
    expect(screen.queryByText(TOUR_HEADING)).not.toBeInTheDocument();

    advancePastAutoShowDelay();

    expect(screen.getByText(TOUR_HEADING)).toBeInTheDocument();
    // Marker is written at open time, so nothing can re-trigger the auto-show.
    expect(localStorage.getItem(onboardingStorageKey(PM_USER.id))).toBe('true');
  });

  it('stays dismissed across a remount (no recurring launch modal)', () => {
    const { unmount } = renderTour();
    advancePastAutoShowDelay();

    fireEvent.click(screen.getAllByRole('button', { name: 'Skip tour' })[0]);
    expect(screen.queryByText(TOUR_HEADING)).not.toBeInTheDocument();

    unmount();
    renderTour();
    advancePastAutoShowDelay();

    expect(screen.queryByText(TOUR_HEADING)).not.toBeInTheDocument();
  });

  it('honours the legacy device-wide marker from the pre-revival tour', () => {
    localStorage.setItem('siteproof_onboarding_completed', 'true');

    renderTour();
    advancePastAutoShowDelay();

    expect(screen.queryByText(TOUR_HEADING)).not.toBeInTheDocument();
  });

  it('keys the marker per user: a different account on the same device still gets its tour', () => {
    localStorage.setItem(onboardingStorageKey('someone-else'), 'true');

    renderTour();
    advancePastAutoShowDelay();

    expect(screen.getByText(TOUR_HEADING)).toBeInTheDocument();
  });
});

describe('OnboardingTour replay entry point', () => {
  it('reopens from the first step for a user who already completed the tour', () => {
    localStorage.setItem(onboardingStorageKey(PM_USER.id), 'true');

    renderTour();
    advancePastAutoShowDelay();
    expect(screen.queryByText(TOUR_HEADING)).not.toBeInTheDocument();

    act(() => {
      startOnboardingTour();
    });

    expect(screen.getByText(TOUR_HEADING)).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 9')).toBeInTheDocument();
  });

  it('ignores the replay event when the tour is disabled for the user (portal context)', () => {
    renderTour({ enabled: false });

    act(() => {
      startOnboardingTour();
    });

    expect(screen.queryByText(TOUR_HEADING)).not.toBeInTheDocument();
  });
});

describe('OnboardingTour foreman wiring', () => {
  it('autoShow=false suppresses the first-run modal but replay still works, without commercial steps', () => {
    mockUser(FOREMAN_USER);
    renderTour({ autoShow: false });

    advancePastAutoShowDelay();
    expect(screen.queryByText(TOUR_HEADING)).not.toBeInTheDocument();

    act(() => {
      startOnboardingTour();
    });

    expect(screen.getByText(TOUR_HEADING)).toBeInTheDocument();
    // The claims/costs step is filtered out: 8 steps instead of 9, and the
    // commercial vocabulary never appears while stepping through.
    expect(screen.getByText('Step 1 of 8')).toBeInTheDocument();
    for (let i = 0; i < 7; i += 1) {
      expect(screen.queryByText('Progress Claims & Costs')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    }
    expect(screen.queryByText('Progress Claims & Costs')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Get Started' })).toBeInTheDocument();
  });
});

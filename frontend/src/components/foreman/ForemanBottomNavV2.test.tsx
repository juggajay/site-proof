import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Capture navigate; keep the rest of react-router-dom real so MemoryRouter and
// useLocation work. The effective-project-id resolution and the badge fetch
// are mocked so the nav's own wiring is what's under test.
const navigateSpy = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateSpy };
});
vi.mock('@/hooks/useEffectiveProjectId', () => ({ useEffectiveProjectId: vi.fn() }));
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn().mockResolvedValue({ blocking: [], dueToday: [] }) };
});

import { ForemanBottomNavV2 } from './ForemanBottomNavV2';
import { useEffectiveProjectId } from '@/hooks/useEffectiveProjectId';

const useEffectiveProjectIdMock = vi.mocked(useEffectiveProjectId);

function renderNav(onCapturePress = vi.fn(), initialPath = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  render(<ForemanBottomNavV2 onCapturePress={onCapturePress} />, { wrapper });
  return { onCapturePress };
}

beforeEach(() => {
  useEffectiveProjectIdMock.mockReturnValue({
    projectId: 'p1',
    isResolving: false,
    hasNoProject: false,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ForemanBottomNavV2', () => {
  it('navigates using the resolved effective project id', () => {
    renderNav();

    fireEvent.click(screen.getByLabelText('Today'));

    expect(navigateSpy).toHaveBeenCalledWith('/projects/p1/foreman/today');
  });

  it('prioritizes issues instead of docket approvals in the primary mobile nav', () => {
    renderNav();

    expect(screen.getByLabelText('Issues')).toBeInTheDocument();
    expect(screen.queryByLabelText('Approve')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Issues'));

    expect(navigateSpy).toHaveBeenCalledWith('/projects/p1/ncr');
  });

  it('marks the issues tab active on the project NCR route', () => {
    renderNav(vi.fn(), '/projects/p1/ncr');

    const issuesTab = screen.getByLabelText('Issues');

    expect(issuesTab).toHaveClass('text-primary');
  });

  it('opens capture without navigating', () => {
    const onCapturePress = vi.fn();
    renderNav(onCapturePress);

    fireEvent.click(screen.getByLabelText('Capture'));

    expect(onCapturePress).toHaveBeenCalledTimes(1);
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('disables the tabs and explains how to get a project when there is none', () => {
    useEffectiveProjectIdMock.mockReturnValue({
      projectId: null,
      isResolving: false,
      hasNoProject: true,
    });

    renderNav();

    expect(screen.getByText(/ask your site manager/i)).toBeInTheDocument();
    const todayTab = screen.getByLabelText('Today');
    expect(todayTab).toBeDisabled();

    fireEvent.click(todayTab);
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('publishes its height for the sync pill and renders no sync strip of its own', () => {
    const offsetHeight = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(72);

    renderNav();

    // The global OfflineIndicator pill anchors above the nav via this
    // variable; the nav itself no longer duplicates offline/pending state.
    expect(document.documentElement.style.getPropertyValue('--bottom-nav-height')).toBe('72px');
    expect(screen.queryByText(/pending sync/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/offline/i)).not.toBeInTheDocument();

    offsetHeight.mockRestore();
  });

  it('keeps the tabs active while a project is still resolving', () => {
    useEffectiveProjectIdMock.mockReturnValue({
      projectId: null,
      isResolving: true,
      hasNoProject: false,
    });

    renderNav();

    expect(screen.queryByText(/ask your site manager/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Today')).not.toBeDisabled();
  });
});

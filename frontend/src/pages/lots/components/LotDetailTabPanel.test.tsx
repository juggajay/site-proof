import { createRef } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';
import { Tabs } from '@/components/ui/tabs';
import { LotDetailTabPanel } from './LotDetailTabPanel';
import { workspaceTabFor } from '../lotWorkspaceTabs';
import type { Lot } from '../types';

// Wiring tests for the tab panel moved out of LotDetailPage. The per-tab
// content components are tested elsewhere (e.g. ITPChecklistTab.test.tsx);
// these tests pin the panel chrome the readiness hook depends on and that the
// page-owned wiring is forwarded unchanged. Only the children the tests mount
// are mocked.
const captured = vi.hoisted(() => ({
  checklistTab: null as Record<string, unknown> | null,
  comments: null as Record<string, unknown> | null,
}));

vi.mock('./ITPChecklistTab', () => ({
  ITPChecklistTab: (props: Record<string, unknown>) => {
    captured.checklistTab = props;
    return <div data-testid="itp-checklist-tab-mock" />;
  },
}));

vi.mock('@/components/comments/CommentsSection', () => ({
  CommentsSection: (props: Record<string, unknown>) => {
    captured.comments = props;
    return <div data-testid="comments-section-mock" />;
  },
}));

afterEach(() => {
  cleanup();
  captured.checklistTab = null;
  captured.comments = null;
});

const lot = { id: 'lot-1', lotNumber: 'EW-001', status: 'in_progress' } as unknown as Lot;

function renderPanel(overrides: Partial<Parameters<typeof LotDetailTabPanel>[0]> = {}) {
  const props: Parameters<typeof LotDetailTabPanel>[0] = {
    tabSectionRef: createRef<HTMLDivElement>(),
    currentTab: 'itp',
    currentTabLabel: 'ITP Checklist',
    highlightedReadinessTab: null,
    lot,
    projectId: 'project-1',
    lotId: 'lot-1',
    itpInstance: null,
    setItpInstance: vi.fn(),
    templates: [],
    loadingItp: false,
    itpLoadError: null,
    isOnline: true,
    isOfflineData: false,
    offlinePendingCount: 0,
    isMobile: false,
    updatingCompletion: null,
    canCompleteITPItems: true,
    canAssignITPTemplate: true,
    toggleCompletion: vi.fn().mockResolvedValue(undefined),
    updateNotes: vi.fn().mockResolvedValue(undefined),
    mobileMarkNA: vi.fn().mockResolvedValue(true),
    mobileMarkFailed: vi.fn().mockResolvedValue(true),
    handleMobileAddPhoto: vi.fn().mockResolvedValue(undefined),
    handleAddPhoto: vi.fn(),
    assignTemplate: vi.fn().mockResolvedValue(true),
    unassignTemplate: vi.fn().mockResolvedValue(true),
    refetchItp: vi.fn().mockResolvedValue(undefined),
    assigningTemplate: false,
    shouldOpenAssignItp: false,
    handleAssignItpActionHandled: vi.fn(),
    setNaModal: vi.fn(),
    setFailedModal: vi.fn(),
    canReviewITP: false,
    currentUserId: undefined,
    verifyCompletion: vi.fn().mockResolvedValue(true),
    rejectCompletion: vi.fn().mockResolvedValue(true),
    testResults: [],
    loadingTests: false,
    ncrs: [],
    loadingNcrs: false,
    handleTabChange: vi.fn(),
    activityLogs: [],
    loadingHistory: false,
    ...overrides,
  };
  // The page renders the panel inside the Radix root that also holds the tab
  // strip — that root is what supplies the panel's tabpanel role and its
  // aria-labelledby pairing.
  const result = renderWithProviders(
    <Tabs value={workspaceTabFor(props.currentTab)}>
      <LotDetailTabPanel {...props} />
    </Tabs>,
  );
  return { props, ...result };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{`${location.pathname}${location.search}`}</div>;
}

describe('LotDetailTabPanel', () => {
  it('keeps the readiness panel chrome and attaches the page-owned ref', () => {
    const tabSectionRef = createRef<HTMLDivElement>();
    renderPanel({ tabSectionRef });

    const panel = screen.getByTestId('lot-tab-panel');
    expect(panel).toHaveAttribute('role', 'tabpanel');
    // Radix names the panel from its trigger rather than a hand-written label.
    expect(panel).toHaveAttribute('aria-labelledby');
    expect(panel).toHaveAttribute('data-tab-label', 'ITP Checklist');
    expect(panel).toHaveAttribute('data-readiness-highlighted', 'false');
    // The readiness hook scrolls/focuses this exact element via the page ref.
    expect(tabSectionRef.current).toBe(panel);
  });

  it('marks the panel readiness-highlighted when the highlighted tab is current', () => {
    renderPanel({ highlightedReadinessTab: 'itp' });

    const panel = screen.getByTestId('lot-tab-panel');
    expect(panel).toHaveAttribute('data-readiness-highlighted', 'true');
    expect(panel.className).toContain('ring-2');
  });

  it('opens Activity directly on the full comments experience', () => {
    renderPanel({ currentTab: 'comments', currentTabLabel: 'Comments' });

    expect(screen.getByTestId('comments-section-mock')).toBeInTheDocument();
    expect(captured.comments).toMatchObject({ entityType: 'Lot', entityId: 'lot-1' });

    // Comments and Changes are subviews, not a merged feed: only the selected
    // one renders, and the history list is not fetched or concatenated in.
    const subviews = screen.getByRole('tablist', { name: 'Activity views' });
    expect(
      within(subviews)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['Comments', 'Changes']);
    expect(screen.queryByTestId('history-tab-content')).not.toBeInTheDocument();
  });

  it('switches to the Changes subview by content tab id', async () => {
    const user = userEvent.setup();
    const handleTabChange = vi.fn();
    renderPanel({ currentTab: 'comments', currentTabLabel: 'Comments', handleTabChange });

    await user.click(screen.getByRole('tab', { name: 'Changes' }));

    // 'history' is the shipped content id behind the "Changes" label.
    expect(handleTabChange).toHaveBeenCalledWith('history');
  });

  it('offers Photos and Documents as Evidence subviews with no aggregate view', () => {
    renderPanel({ currentTab: 'documents', currentTabLabel: 'Documents' });

    const subviews = screen.getByRole('tablist', { name: 'Evidence views' });
    expect(
      within(subviews)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['Photos', 'Documents']);
    expect(within(subviews).queryByRole('tab', { name: /all/i })).not.toBeInTheDocument();
    // Every subview trigger clears the 48px tap-target minimum.
    for (const tab of within(subviews).getAllByRole('tab')) {
      expect(tab).toHaveClass('min-h-[48px]');
    }
  });

  it('forwards the assign-itp readiness wiring to ITPChecklistTab', () => {
    const handleAssignItpActionHandled = vi.fn();
    const unassignTemplate = vi.fn().mockResolvedValue(true);
    renderPanel({ shouldOpenAssignItp: true, handleAssignItpActionHandled, unassignTemplate });

    expect(screen.getByTestId('itp-checklist-tab-mock')).toBeInTheDocument();
    expect(captured.checklistTab).toMatchObject({ autoOpenAssignTemplate: true });
    expect(captured.checklistTab?.onAutoOpenAssignTemplateHandled).toBe(
      handleAssignItpActionHandled,
    );
    expect(captured.checklistTab?.onUnassignTemplate).toBe(unassignTemplate);
  });

  it('opens the project documents page with the current lot selected for uploads', () => {
    const { props } = renderPanel({
      currentTab: 'documents',
      currentTabLabel: 'Documents',
    });
    cleanup();

    renderWithProviders(
      <Routes>
        <Route
          path="/"
          element={
            <Tabs value="evidence">
              <LotDetailTabPanel {...props} />
            </Tabs>
          }
        />
        <Route path="/projects/:projectId/documents" element={<LocationProbe />} />
      </Routes>,
      { initialEntries: ['/'] },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Upload Document' }));

    expect(screen.getByTestId('location-probe')).toHaveTextContent(
      '/projects/project-1/documents?lotId=lot-1&upload=1',
    );
  });
});

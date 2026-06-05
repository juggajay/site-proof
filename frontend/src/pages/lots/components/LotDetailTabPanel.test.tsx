import { createRef } from 'react';
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';
import { LotDetailTabPanel } from './LotDetailTabPanel';
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
    mobileMarkNA: vi.fn().mockResolvedValue(undefined),
    mobileMarkFailed: vi.fn().mockResolvedValue(undefined),
    handleMobileAddPhoto: vi.fn().mockResolvedValue(undefined),
    handleAddPhoto: vi.fn(),
    assignTemplate: vi.fn().mockResolvedValue(true),
    refetchItp: vi.fn().mockResolvedValue(undefined),
    assigningTemplate: false,
    shouldOpenAssignItp: false,
    handleAssignItpActionHandled: vi.fn(),
    setNaModal: vi.fn(),
    setFailedModal: vi.fn(),
    testResults: [],
    loadingTests: false,
    ncrs: [],
    loadingNcrs: false,
    handleTabChange: vi.fn(),
    activityLogs: [],
    loadingHistory: false,
    ...overrides,
  };
  const result = renderWithProviders(<LotDetailTabPanel {...props} />);
  return { props, ...result };
}

describe('LotDetailTabPanel', () => {
  it('keeps the readiness panel chrome and attaches the page-owned ref', () => {
    const tabSectionRef = createRef<HTMLDivElement>();
    renderPanel({ tabSectionRef });

    const panel = screen.getByTestId('lot-tab-panel');
    expect(panel).toHaveAttribute('role', 'tabpanel');
    expect(panel).toHaveAttribute('aria-label', 'ITP Checklist section');
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

  it('renders the comments tab with the Lot entity type', () => {
    renderPanel({ currentTab: 'comments', currentTabLabel: 'Comments' });

    expect(screen.getByTestId('comments-section-mock')).toBeInTheDocument();
    expect(captured.comments).toMatchObject({ entityType: 'Lot', entityId: 'lot-1' });
  });

  it('forwards the assign-itp readiness wiring to ITPChecklistTab', () => {
    const handleAssignItpActionHandled = vi.fn();
    renderPanel({ shouldOpenAssignItp: true, handleAssignItpActionHandled });

    expect(screen.getByTestId('itp-checklist-tab-mock')).toBeInTheDocument();
    expect(captured.checklistTab).toMatchObject({ autoOpenAssignTemplate: true });
    expect(captured.checklistTab?.onAutoOpenAssignTemplateHandled).toBe(
      handleAssignItpActionHandled,
    );
  });
});

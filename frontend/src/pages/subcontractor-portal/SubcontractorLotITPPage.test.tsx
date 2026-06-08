import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Trust-boundary regression test for the subbie portal ITP page.
 *
 * The portal page owns the capability gate: `canCompleteItems` is derived ONLY
 * from the lot's `subcontractorAssignments[].canCompleteITP` (never from
 * `user.role`), and `requireCompletionAccess` is injected into the shared
 * `useItpCompletionActions` hook. This test proves that when `canCompleteITP`
 * is false, a subbie CANNOT mutate: invoking a completion handler fires NO
 * POST/PATCH to `/api/itp/completions` and surfaces the "View only" toast. It
 * must fail if a future change lets the hook bypass the page gate.
 *
 * We mock MobileITPChecklist to capture the exact handler props the page wires,
 * then drive them directly — the real page -> hook -> gate path runs unmocked.
 */

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn(), authFetch: vi.fn() };
});
vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));
vi.mock('@/lib/logger', () => ({ devLog: vi.fn(), devWarn: vi.fn(), logError: vi.fn() }));

// Capture the props MobileITPChecklist receives so we can invoke the real,
// page-wired handlers (which run through the shared hook + the page's gate).
interface CapturedChecklistProps {
  canCompleteItems?: boolean;
  onToggleCompletion: (id: string, isCompleted: boolean, notes: string | null) => Promise<void>;
  onMarkNotApplicable: (id: string, reason: string) => Promise<void>;
  onMarkFailed: (id: string, reason: string) => Promise<void>;
  onUpdateNotes: (id: string, notes: string) => Promise<void>;
}
let capturedProps: CapturedChecklistProps | null = null;
vi.mock('@/components/foreman/MobileITPChecklist', () => ({
  MobileITPChecklist: (props: CapturedChecklistProps) => {
    capturedProps = props;
    return (
      <div data-testid="mobile-itp-checklist" data-can-complete={String(props.canCompleteItems)}>
        {props.canCompleteItems === false && <div data-testid="read-only-notice">View only</div>}
      </div>
    );
  },
}));

import { apiFetch } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import { SubcontractorLotITPPage } from './SubcontractorLotITPPage';

const instance = {
  id: 'instance-1',
  status: 'in_progress',
  template: {
    id: 'template-1',
    name: 'Earthworks ITP',
    activityType: 'Earthworks',
    checklistItems: [
      {
        id: 'item-1',
        description: 'Compaction',
        category: 'General',
        responsibleParty: 'subcontractor',
        isHoldPoint: false,
        pointType: 'standard',
        evidenceRequired: 'none',
        order: 0,
        testType: null,
        acceptanceCriteria: null,
      },
    ],
  },
  completions: [
    {
      id: 'completion-1',
      checklistItemId: 'item-1',
      isCompleted: false,
      isNotApplicable: false,
      isFailed: false,
      notes: null,
      completedAt: null,
      completedBy: null,
      isVerified: false,
      verifiedAt: null,
      verifiedBy: null,
      attachments: [],
    },
  ],
};

function lotResponse(canCompleteITP: boolean) {
  return {
    lot: {
      id: 'lot-1',
      projectId: 'project-1',
      lotNumber: 'LOT-001',
      status: 'open',
      subcontractorAssignments: [{ canCompleteITP, itpRequiresVerification: false }],
    },
  };
}

// Route apiFetch by URL: the lot read drives the gate; the instance read renders.
function mockApi(canCompleteITP: boolean) {
  vi.mocked(apiFetch).mockImplementation(async (url: string, options?: RequestInit) => {
    const method = options?.method ?? 'GET';
    if (url.includes('/api/lots/') && method === 'GET') return lotResponse(canCompleteITP);
    if (url.includes('/api/itp/instances/lot/') && method === 'GET') return { instance };
    // Any mutating completion call is a trust-boundary violation in the false case.
    if (url.includes('/api/itp/completions')) return { completion: instance.completions[0] };
    throw new Error(`Unexpected apiFetch ${method} ${url}`);
  });
}

function mutatingCompletionCalls() {
  return vi
    .mocked(apiFetch)
    .mock.calls.filter(
      ([url, options]) =>
        typeof url === 'string' &&
        url.includes('/api/itp/completions') &&
        ((options as { method?: string })?.method === 'POST' ||
          (options as { method?: string })?.method === 'PATCH'),
    );
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/subcontractor-portal/itps/lot-1']}>
      <Routes>
        <Route path="/subcontractor-portal/itps/:lotId" element={<SubcontractorLotITPPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedProps = null;
});
afterEach(() => vi.clearAllMocks());

describe('SubcontractorLotITPPage — trust boundary', () => {
  it('renders the checklist in read-only mode when canCompleteITP is false', async () => {
    mockApi(false);
    renderPage();

    await waitFor(() => expect(screen.getByTestId('mobile-itp-checklist')).toBeInTheDocument());
    expect(screen.getByTestId('mobile-itp-checklist')).toHaveAttribute(
      'data-can-complete',
      'false',
    );
    expect(screen.getByTestId('read-only-notice')).toBeInTheDocument();
  });

  it('blocks EVERY completion action when canCompleteITP is false (no mutating request, "View only" toast)', async () => {
    mockApi(false);
    renderPage();
    await waitFor(() => expect(capturedProps).not.toBeNull());

    // Invoke the real page-wired handlers (page -> shared hook -> injected gate).
    await capturedProps!.onToggleCompletion('item-1', true, null);
    await capturedProps!.onMarkNotApplicable('item-1', 'x');
    await capturedProps!.onMarkFailed('item-1', 'x');
    await capturedProps!.onUpdateNotes('item-1', 'x');

    // The gate must have blocked all four: zero mutating completion requests.
    expect(mutatingCompletionCalls()).toHaveLength(0);
    // And the view-only feedback fired (the page's requireCompletionAccess toast).
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'View only', variant: 'error' }),
    );
  });

  it('positive control: a Failed action DOES fire its mutating request when canCompleteITP is true', async () => {
    mockApi(true);
    renderPage();
    await waitFor(() => expect(capturedProps).not.toBeNull());
    expect(screen.getByTestId('mobile-itp-checklist')).toHaveAttribute('data-can-complete', 'true');

    await capturedProps!.onMarkFailed('item-1', 'cracked');

    const calls = mutatingCompletionCalls();
    expect(calls).toHaveLength(1);
    const [url, options] = calls[0] as [string, RequestInit];
    expect(url).toBe('/api/itp/completions');
    expect(options.method).toBe('POST');
    // The Failed/NCR body must remain byte-faithful through the page wiring.
    expect(JSON.parse(options.body as string)).toEqual({
      itpInstanceId: 'instance-1',
      checklistItemId: 'item-1',
      status: 'failed',
      notes: 'Failed: cracked',
      ncrDescription: 'cracked',
      ncrCategory: 'workmanship',
      ncrSeverity: 'minor',
    });
  });
});

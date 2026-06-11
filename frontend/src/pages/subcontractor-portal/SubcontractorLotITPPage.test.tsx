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
// The page reads the auth user only for capturedBy on the offline fallback.
vi.mock('@/lib/auth', () => ({ useAuth: vi.fn(() => ({ user: { id: 'subbie-1' } })) }));
// The offline pipeline boundary: the shared upload falls back to this on a
// retriable network failure. Mocked so no Dexie/IndexedDB is touched here.
vi.mock('@/lib/offlineDb', () => ({ capturePhotoOffline: vi.fn() }));

// The portal photo upload reuses the shared upload-then-attach, which captures a
// GPS fix. Mock only getGPSLocation so we can assert the geotag is sent.
// `vi.hoisted` so the mock is initialized before the hoisted vi.mock factory.
const { getGPSLocationMock } = vi.hoisted(() => ({ getGPSLocationMock: vi.fn() }));
vi.mock('@/pages/lots/lib/itpEvidence', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/pages/lots/lib/itpEvidence')>();
  return { ...actual, getGPSLocation: getGPSLocationMock };
});

// Capture the props MobileITPChecklist receives so we can invoke the real,
// page-wired handlers (which run through the shared hook + the page's gate).
interface CapturedChecklistProps {
  canCompleteItems?: boolean;
  onToggleCompletion: (id: string, isCompleted: boolean, notes: string | null) => Promise<void>;
  onMarkNotApplicable: (id: string, reason: string) => Promise<boolean>;
  onMarkFailed: (id: string, reason: string) => Promise<boolean>;
  onUpdateNotes: (id: string, notes: string) => Promise<void>;
  onAddPhoto: (id: string, file: File) => Promise<void>;
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

import { apiFetch, authFetch } from '@/lib/api';
import { capturePhotoOffline } from '@/lib/offlineDb';
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

describe('SubcontractorLotITPPage — photo upload (shared upload-then-attach)', () => {
  const imageFile = new File(['x'], 'site-photo.jpg', { type: 'image/jpeg' });

  // Route the upload POST (authFetch) and the attach POST (apiFetch) so the
  // page -> shared uploadItpEvidencePhoto path runs end-to-end.
  function mockApiForUpload() {
    vi.mocked(apiFetch).mockImplementation(async (url: string, options?: RequestInit) => {
      const method = options?.method ?? 'GET';
      if (url.includes('/api/lots/') && method === 'GET') return lotResponse(true);
      if (url.includes('/api/itp/instances/lot/') && method === 'GET') return { instance };
      if (url.includes('/attachments') && method === 'POST') {
        return { attachment: { id: 'attachment-1', documentId: 'document-1' } };
      }
      throw new Error(`Unexpected apiFetch ${method} ${url}`);
    });
    vi.mocked(authFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'document-1' }),
    } as unknown as Response);
  }

  function attachmentCall() {
    return vi
      .mocked(apiFetch)
      .mock.calls.find(
        ([url, options]) =>
          typeof url === 'string' &&
          url.includes('/attachments') &&
          (options as { method?: string })?.method === 'POST',
      ) as [string, RequestInit] | undefined;
  }

  it('sends the geotag and an encodeURIComponent-encoded attachment URL (HC parity)', async () => {
    getGPSLocationMock.mockResolvedValue({ latitude: -33.8688, longitude: 151.2093 });
    mockApiForUpload();
    renderPage();
    await waitFor(() => expect(capturedProps).not.toBeNull());

    await capturedProps!.onAddPhoto('item-1', imageFile);

    // The upload went through the documents API.
    expect(authFetch).toHaveBeenCalledWith(
      '/api/documents/upload',
      expect.objectContaining({ method: 'POST' }),
    );

    const call = attachmentCall();
    expect(call).toBeDefined();
    const [attachUrl, attachOptions] = call!;
    // completion-1 has no special chars, but the encode wrapper must still be used.
    expect(attachUrl).toBe(
      `/api/itp/completions/${encodeURIComponent('completion-1')}/attachments`,
    );
    const body = JSON.parse(attachOptions.body as string);
    expect(body.gpsLatitude).toBe(-33.8688);
    expect(body.gpsLongitude).toBe(151.2093);
    expect(body.documentId).toBe('document-1');
  });

  it('does NOT classify the photo and skips the offline queue when the upload succeeds', async () => {
    getGPSLocationMock.mockResolvedValue(null);
    mockApiForUpload();
    renderPage();
    await waitFor(() => expect(capturedProps).not.toBeNull());

    await capturedProps!.onAddPhoto('item-1', imageFile);

    // No AI classification endpoint is hit on the subbie path.
    const classifyHit = vi
      .mocked(apiFetch)
      .mock.calls.some(([url]) => typeof url === 'string' && url.includes('/classify'));
    expect(classifyHit).toBe(false);
    // The offline pipeline is a fallback only: a successful online upload must
    // never write the photo into the on-device queue.
    expect(capturePhotoOffline).not.toHaveBeenCalled();
    expect(getGPSLocationMock).toHaveBeenCalled();
  });

  it('queues the photo offline with the completion linkage when the upload fails retriably', async () => {
    getGPSLocationMock.mockResolvedValue(null);
    vi.mocked(capturePhotoOffline).mockResolvedValue({ id: 'photo-1' } as Awaited<
      ReturnType<typeof capturePhotoOffline>
    >);
    // Page loads fine; the evidence upload itself dies at the fetch level.
    vi.mocked(apiFetch).mockImplementation(async (url: string, options?: RequestInit) => {
      const method = options?.method ?? 'GET';
      if (url.includes('/api/lots/') && method === 'GET') return lotResponse(true);
      if (url.includes('/api/itp/instances/lot/') && method === 'GET') return { instance };
      throw new Error(`Unexpected apiFetch ${method} ${url}`);
    });
    vi.mocked(authFetch).mockRejectedValue(new TypeError('Failed to fetch'));
    renderPage();
    await waitFor(() => expect(capturedProps).not.toBeNull());

    await capturedProps!.onAddPhoto('item-1', imageFile);

    // The photo went into the offline pipeline with explicit ITP completion
    // attachment intent for the sync worker to finish after upload.
    expect(capturePhotoOffline).toHaveBeenCalledWith(
      'project-1',
      imageFile,
      expect.objectContaining({
        lotId: 'lot-1',
        entityType: 'itp',
        entityId: 'completion-1',
        completionId: 'completion-1',
        attachAs: 'itp_completion_attachment',
        category: 'itp_evidence',
        capturedBy: 'subbie-1',
      }),
    );
    // Honest feedback: saved on device, not "uploaded".
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Saved Offline' }));
    expect(attachmentCall()).toBeUndefined();
  });

  it('blocks photo upload when canCompleteITP is false (no upload, "View only" toast)', async () => {
    getGPSLocationMock.mockResolvedValue(null);
    // canCompleteITP false: the gate must abort before any upload.
    vi.mocked(apiFetch).mockImplementation(async (url: string, options?: RequestInit) => {
      const method = options?.method ?? 'GET';
      if (url.includes('/api/lots/') && method === 'GET') return lotResponse(false);
      if (url.includes('/api/itp/instances/lot/') && method === 'GET') return { instance };
      throw new Error(`Unexpected apiFetch ${method} ${url}`);
    });
    renderPage();
    await waitFor(() => expect(capturedProps).not.toBeNull());

    await capturedProps!.onAddPhoto('item-1', imageFile);

    expect(authFetch).not.toHaveBeenCalled();
    expect(attachmentCall()).toBeUndefined();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'View only', variant: 'error' }),
    );
  });
});

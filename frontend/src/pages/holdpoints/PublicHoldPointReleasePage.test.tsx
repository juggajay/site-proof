/**
 * Benchmark T3, end to end on the page: the approver's verb reaches the token
 * door, and a rejection is reported as a rejection rather than dressed up as a
 * release.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api';
import { PublicHoldPointReleasePage } from './PublicHoldPointReleasePage';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});

vi.mock('@/components/ui/SignaturePad', () => ({
  SignaturePad: ({ onChange }: { onChange: (value: string | null) => void }) => (
    <button type="button" onClick={() => onChange('data:image/png;base64,AAA')}>
      Sign
    </button>
  ),
}));

vi.mock('./components/HoldPointEvidencePackageCard', () => ({
  HoldPointEvidencePackageCard: () => <div data-testid="evidence-package" />,
}));

const apiFetchMock = vi.mocked(apiFetch);

const evidencePackage = {
  project: { name: 'Northern Highway', projectNumber: 'P-1' },
  lot: { lotNumber: 'LOT-001', activityType: 'Unbound Pavement' },
  holdPoint: {
    description: 'Proof roll before overlay',
    itpChecklistItemId: 'item-1',
    status: 'notified',
    scheduledDate: '2026-09-04T00:00:00.000Z',
    releasedAt: null,
    releasedByName: null,
    releasedByOrg: null,
    releaseMethod: null,
    releaseNotes: null,
  },
  summary: {
    completedItems: 8,
    totalChecklistItems: 10,
    verifiedItems: 6,
    totalTestResults: 3,
    totalPhotos: 12,
  },
  checklist: [],
};

function loadResponse() {
  return {
    evidencePackage,
    tokenInfo: {
      recipientEmail: 'super@example.com',
      recipientName: 'Amos Soo',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      canRelease: true,
    },
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hp-release/tok-1']}>
      <Routes>
        <Route path="/hp-release/:token" element={<PublicHoldPointReleasePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const REASON = 'Compaction results do not meet the specified 95% RDD for this layer.';

beforeEach(() => {
  apiFetchMock.mockReset();
});

describe('PublicHoldPointReleasePage decisions', () => {
  it('sends the chosen verb and its reason to the token door', async () => {
    apiFetchMock.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve({
          success: true,
          message: 'Hold point rejected via secure link',
          holdPoint: {
            status: 'rejected',
            itpChecklistItemId: 'item-1',
            releasedAt: null,
            releasedByName: null,
            releasedByOrg: null,
            releaseMethod: null,
            releaseNotes: REASON,
          },
        }) as never;
      }
      return Promise.resolve(loadResponse()) as never;
    });

    renderPage();

    await screen.findByRole('heading', { name: /Proof roll before overlay/i });
    await userEvent.click(screen.getByRole('button', { name: 'Sign' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Reject' }));
    await userEvent.type(screen.getByLabelText(/Reason for rejection/i), REASON);
    await userEvent.click(screen.getByRole('button', { name: /Reject hold point/i }));

    await waitFor(() => {
      const post = apiFetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
      expect(post).toBeDefined();
      expect(JSON.parse((post![1] as RequestInit).body as string)).toMatchObject({
        decision: 'reject',
        releaseNotes: REASON,
      });
    });
  });

  it('reports a rejection as a rejection, not a release', async () => {
    apiFetchMock.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve({
          success: true,
          message: 'Hold point rejected via secure link',
          holdPoint: {
            status: 'rejected',
            itpChecklistItemId: 'item-1',
            releasedAt: null,
            releasedByName: null,
            releasedByOrg: null,
            releaseMethod: null,
            releaseNotes: REASON,
          },
        }) as never;
      }
      return Promise.resolve(loadResponse()) as never;
    });

    renderPage();

    await screen.findByRole('heading', { name: /Proof roll before overlay/i });
    await userEvent.click(screen.getByRole('button', { name: 'Sign' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Reject' }));
    await userEvent.type(screen.getByLabelText(/Reason for rejection/i), REASON);
    await userEvent.click(screen.getByRole('button', { name: /Reject hold point/i }));

    expect(await screen.findByText(/Hold Point Rejected/i)).toBeInTheDocument();
    expect(screen.getByText(/Nothing has been released/i)).toBeInTheDocument();
    expect(screen.getByText(REASON)).toBeInTheDocument();
    expect(screen.queryByText(/Hold Point Released/i)).not.toBeInTheDocument();
  });

  it('defaults to Release and confirms a release the old way', async () => {
    const releasedAt = new Date().toISOString();
    apiFetchMock.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve({
          success: true,
          message: 'Hold point released successfully via secure link',
          holdPoint: {
            status: 'released',
            itpChecklistItemId: 'item-1',
            releasedAt,
            releasedByName: 'Amos Soo',
            releasedByOrg: 'Client Company',
            releaseMethod: 'secure_link',
            releaseNotes: null,
          },
        }) as never;
      }
      return Promise.resolve(loadResponse()) as never;
    });

    renderPage();

    await screen.findByRole('heading', { name: /Proof roll before overlay/i });
    expect(screen.getByRole('radio', { name: 'Release' })).toBeChecked();

    await userEvent.click(screen.getByRole('button', { name: 'Sign' }));
    await userEvent.click(screen.getByRole('button', { name: /Release hold point/i }));

    expect(await screen.findByText(/Hold Point Released/i)).toBeInTheDocument();

    const post = apiFetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse((post![1] as RequestInit).body as string)).toMatchObject({
      decision: 'release',
    });
  });

  it('locks the actioning identity to the invited recipient', async () => {
    apiFetchMock.mockResolvedValue(loadResponse() as never);

    renderPage();

    const nameField = await screen.findByLabelText(/Actioned by/i);
    expect(nameField).toHaveValue('Amos Soo');
    expect(nameField).toBeDisabled();
  });
});

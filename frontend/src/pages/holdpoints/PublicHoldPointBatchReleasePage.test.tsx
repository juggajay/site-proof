/**
 * Tests for the public batch hold-point release page.
 *
 * MOCKS @/lib/api (apiFetch routed by URL) and @/components/ui/SignaturePad
 * (a button that emits a signature data URL). Covers: load → summary+rows,
 * lazy expand fetches + renders a package, release happy path advances
 * progress and marks the row released, and the unavailable-token treatment.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { releasedHpEvidencePackageFixture } from '@/lib/pdf/__tests__/fixtures/holdPointEvidenceFixtures';

const apiFetchMock = vi.fn();
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: (...a: unknown[]) => apiFetchMock(...a) };
});

vi.mock('@/components/ui/SignaturePad', () => ({
  SignaturePad: ({ onChange }: { onChange: (v: string | null) => void }) => (
    <button type="button" onClick={() => onChange('data:image/png;base64,sig')}>
      mock-sign
    </button>
  ),
}));

import { PublicHoldPointBatchReleasePage } from './PublicHoldPointBatchReleasePage';

const BATCH = {
  isPublicAccess: true as const,
  batch: {
    project: { name: 'Pacific Highway Upgrade', projectNumber: 'PHU-001' },
    lot: { lotNumber: 'EW-001', activityType: 'Earthworks' },
    requestedBy: 'Riley Foreman',
    scheduledDate: '2026-05-27T00:00:00.000Z',
    scheduledTime: '08:00',
    recipient: { email: 'sam@example.com', name: 'Sam Supervisor' },
    expiresAt: '2026-06-01T00:00:00.000Z',
    holdPoints: [
      {
        holdPointId: 'hp-1',
        sequenceNumber: 1,
        description: 'Subgrade proof roll prior to pavement layer',
        status: 'pending',
        releasedAt: null,
        releasedByName: null,
      },
      {
        holdPointId: 'hp-2',
        sequenceNumber: 2,
        description: 'Concrete pour hold point awaiting release',
        status: 'pending',
        releasedAt: null,
        releasedByName: null,
      },
    ],
  },
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hp-release/batch/tok123']}>
      <Routes>
        <Route path="/hp-release/batch/:token" element={<PublicHoldPointBatchReleasePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  apiFetchMock.mockReset();
});

describe('PublicHoldPointBatchReleasePage', () => {
  it('renders summary and one row per hold point after loading', async () => {
    apiFetchMock.mockResolvedValueOnce(BATCH);
    renderPage();

    await waitFor(() =>
      expect(screen.getByText('Pacific Highway Upgrade (PHU-001)')).toBeInTheDocument(),
    );
    expect(screen.getByText('0 of 2 released')).toBeInTheDocument();
    expect(screen.getByText('1. Subgrade proof roll prior to pavement layer')).toBeInTheDocument();
    expect(screen.getByText('2. Concrete pour hold point awaiting release')).toBeInTheDocument();
  });

  it('lazily fetches and renders a hold point evidence package when expanded', async () => {
    apiFetchMock.mockResolvedValueOnce(BATCH).mockResolvedValueOnce({
      evidencePackage: releasedHpEvidencePackageFixture,
      tokenInfo: {
        recipientEmail: 'sam@example.com',
        recipientName: 'Sam Supervisor',
        expiresAt: '2026-06-01T00:00:00.000Z',
        canRelease: true,
      },
      isPublicAccess: true,
    });

    renderPage();
    await waitFor(() =>
      expect(
        screen.getByText('1. Subgrade proof roll prior to pavement layer'),
      ).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByText('1. Subgrade proof roll prior to pavement layer'));

    await waitFor(() => expect(screen.getByText('Evidence Package')).toBeInTheDocument());
    expect(
      apiFetchMock.mock.calls.some((call) => String(call[0]).includes('/holdpoints/hp-1')),
    ).toBe(true);
    // A checklist row from the fixture is rendered inside the card.
    expect(screen.getByText('1. Confirm survey set-out')).toBeInTheDocument();
  });

  it('releases the selected hold point and advances the progress line', async () => {
    apiFetchMock.mockResolvedValueOnce(BATCH).mockResolvedValueOnce({
      success: true,
      message: 'Released 1 hold point.',
      released: [
        {
          id: 'hp-1',
          description: 'Subgrade proof roll prior to pavement layer',
          itpChecklistItemId: null,
          status: 'released',
          releasedAt: '2026-05-28T00:00:00.000Z',
          releasedByName: 'Sam Supervisor',
          releasedByOrg: null,
          releaseMethod: 'secure_link',
          releaseNotes: null,
          lot: { id: 'lot-1', lotNumber: 'EW-001' },
        },
      ],
    });

    renderPage();
    await waitFor(() => expect(screen.getByText('0 of 2 released')).toBeInTheDocument());

    fireEvent.click(
      screen.getByLabelText('Select hold point Subgrade proof roll prior to pavement layer'),
    );
    fireEvent.click(screen.getByText('mock-sign'));
    fireEvent.click(screen.getByRole('button', { name: /Release selected \(1\)/ }));

    await waitFor(() => expect(screen.getByText('1 of 2 released')).toBeInTheDocument());
    expect(screen.getByText('Released by Sam Supervisor')).toBeInTheDocument();
    expect(screen.getByText('Released 1 hold point.')).toBeInTheDocument();
  });

  it('shows the unavailable treatment when the token load fails', async () => {
    apiFetchMock.mockRejectedValueOnce(new Error('This release link is invalid or has expired.'));
    renderPage();

    await waitFor(() => expect(screen.getByText('Release Link Unavailable')).toBeInTheDocument());
    expect(screen.getByText('This release link is invalid or has expired.')).toBeInTheDocument();
  });
});

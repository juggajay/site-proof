/**
 * RequestReleaseModal — unit tests
 *
 * Covers:
 * 1. Desktop render: form fields visible in a dialog
 * 2. Mobile render: BottomSheet with correct aria-label
 * 3. Loading state: spinner visible, no form
 * 4. Cannot-request state: warning block visible
 */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { authFetch } from '@/lib/api';
import { RequestReleaseModal } from './RequestReleaseModal';
import type { HoldPoint, HoldPointDetails } from '../types';

// ── Mock BottomSheet ───────────────────────────────────────────────────────
vi.mock('@/components/foreman/sheets/BottomSheet', () => ({
  BottomSheet: ({
    isOpen,
    title,
    children,
  }: {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
  }) =>
    isOpen ? (
      <div data-testid="bottom-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div data-testid="bottom-sheet-title">{title}</div>
        {children}
      </div>
    ) : null,
}));

// ── useIsMobile: default false ─────────────────────────────────────────────
const useIsMobileMock = vi.hoisted(() => vi.fn(() => false));
vi.mock('@/hooks/useMediaQuery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useMediaQuery')>();
  return { ...actual, useIsMobile: useIsMobileMock };
});

// ── Stub apiFetch (preview package) ───────────────────────────────────────
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn(), authFetch: vi.fn() };
});

function makeHoldPoint(overrides: Partial<HoldPoint> = {}): HoldPoint {
  return {
    id: 'hp-1',
    lotId: 'lot-1',
    lotNumber: 'LOT-001',
    itpChecklistItemId: 'item-1',
    description: 'Formation check',
    pointType: 'hold',
    status: 'pending',
    notificationSentAt: null,
    scheduledDate: null,
    releasedAt: null,
    releasedByName: null,
    releaseNotes: null,
    sequenceNumber: 3,
    isCompleted: false,
    isVerified: false,
    createdAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeDetails(overrides: Partial<HoldPointDetails> = {}): HoldPointDetails {
  return {
    holdPoint: makeHoldPoint(),
    prerequisites: [],
    incompletePrerequisites: [],
    canRequestRelease: true,
    defaultRecipients: ['inspector@example.com'],
    approvalRequirement: 'any',
    ...overrides,
  };
}

describe('RequestReleaseModal — desktop', () => {
  it('renders the request release form in a dialog with all inputs', () => {
    useIsMobileMock.mockReturnValue(false);

    render(
      <RequestReleaseModal
        holdPoint={makeHoldPoint()}
        details={makeDetails()}
        loading={false}
        requesting={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('All prerequisites completed')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('inspector@example.com, superintendent@example.com'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request Release' })).toBeInTheDocument();
  });

  it('pre-fills the notification email from defaultRecipients', () => {
    useIsMobileMock.mockReturnValue(false);

    render(
      <RequestReleaseModal
        holdPoint={makeHoldPoint()}
        details={makeDetails({ defaultRecipients: ['super@example.com'] })}
        loading={false}
        requesting={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(
      screen.getByPlaceholderText('inspector@example.com, superintendent@example.com'),
    ).toHaveValue('super@example.com');
  });

  it('uploads request evidence and includes uploaded document ids in the submit payload', async () => {
    window.history.pushState({}, '', '/projects/project-1/hold-points');
    useIsMobileMock.mockReturnValue(false);
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    vi.mocked(authFetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'doc-1', filename: 'proof.pdf' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(
      <RequestReleaseModal
        holdPoint={makeHoldPoint()}
        details={makeDetails()}
        loading={false}
        requesting={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    const evidenceFile = new File(['release proof'], 'proof.pdf', {
      type: 'application/pdf',
    });
    await user.upload(screen.getByLabelText('Release Evidence'), evidenceFile);

    expect(await screen.findByText('Uploaded: proof.pdf')).toBeInTheDocument();
    expect(authFetch).toHaveBeenCalledWith(
      '/api/documents/upload',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    );
    const uploadBody = vi.mocked(authFetch).mock.calls[0][1]?.body as FormData;
    expect(uploadBody.get('projectId')).toBe('project-1');
    expect(uploadBody.get('lotId')).toBe('lot-1');
    expect(uploadBody.get('documentType')).toBe('hold_point_request_evidence');
    expect(uploadBody.get('category')).toBe('itp_evidence');
    expect(uploadBody.get('file')).toBe(evidenceFile);

    fireEvent.change(screen.getByLabelText('Scheduled Date'), {
      target: { value: '2026-07-10' },
    });
    fireEvent.change(screen.getByLabelText('Scheduled Time'), {
      target: { value: '09:30' },
    });
    await user.click(screen.getByRole('button', { name: 'Request Release' }));

    expect(onSubmit).toHaveBeenCalledWith(
      '2026-07-10',
      '09:30',
      'inspector@example.com',
      undefined,
      undefined,
      ['doc-1'],
    );
  });
});

describe('RequestReleaseModal — mobile (BottomSheet)', () => {
  it('renders inside a BottomSheet with the correct dialog title', () => {
    useIsMobileMock.mockReturnValue(true);

    render(
      <RequestReleaseModal
        holdPoint={makeHoldPoint()}
        details={makeDetails()}
        loading={false}
        requesting={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const sheet = screen.getByTestId('bottom-sheet');
    expect(sheet).toBeInTheDocument();
    expect(sheet).toHaveAttribute('aria-label', 'Request Hold Point Release');
    expect(screen.getByText('All prerequisites completed')).toBeInTheDocument();
  });
});

describe('RequestReleaseModal — loading state', () => {
  it('shows a loading spinner and no form', () => {
    useIsMobileMock.mockReturnValue(false);

    render(
      <RequestReleaseModal
        holdPoint={makeHoldPoint()}
        details={null}
        loading={true}
        requesting={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole('status', { name: 'Loading hold point details' })).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText('inspector@example.com, superintendent@example.com'),
    ).not.toBeInTheDocument();
  });
});

describe('RequestReleaseModal — cannot request state', () => {
  it('shows the blocking warning when prerequisites are incomplete', () => {
    useIsMobileMock.mockReturnValue(false);

    render(
      <RequestReleaseModal
        holdPoint={makeHoldPoint()}
        details={makeDetails({
          canRequestRelease: false,
          incompletePrerequisites: [
            {
              id: 'p-1',
              sequenceNumber: 1,
              description: 'Compact to 98% std',
              isHoldPoint: false,
              isCompleted: false,
              isVerified: false,
              completedAt: null,
            },
          ],
        })}
        loading={false}
        requesting={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Cannot request release yet');
    // The item description is split across JSX nodes ("1", ". ", "Compact...").
    // Use a partial text matcher to locate it.
    expect(screen.getByText(/Compact to 98% std/)).toBeInTheDocument();
    // The footer has a 'Close' button; the Dialog also has an sr-only 'Close' X.
    // getAllByRole handles both and we just need at least one visible close control.
    expect(screen.getAllByRole('button', { name: 'Close' }).length).toBeGreaterThanOrEqual(1);
  });
});

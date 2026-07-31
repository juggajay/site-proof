/**
 * Tests for DocSheet — the /m/docs card's destination.
 *
 * Pins the trade the card rules bought: the file opens from ONE prominent
 * button inside the sheet (with its own local spinner, not a list-wide
 * disable), the revision history is the shared timeline body rather than a
 * second implementation, and with governance off the history section — heading
 * included — is not rendered at all.
 *
 * Mobile is forced via useIsMobile so ResponsiveSheet resolves to the shipped
 * BottomSheet, which is the surface this was designed against.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { DocItem } from '../docsShellState';

const { apiGetMock, FakeApiError } = vi.hoisted(() => ({
  apiGetMock: vi.fn(),
  FakeApiError: class extends Error {
    status: number;
    constructor(status: number) {
      super(`API Error ${status}`);
      this.name = 'ApiError';
      this.status = status;
    }
  },
}));

vi.mock('@/lib/api', () => ({
  apiGet: apiGetMock,
  apiPost: vi.fn(),
  ApiError: FakeApiError,
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'user-me', fullName: 'Jay', roleInCompany: 'foreman' } }),
}));
vi.mock('@/hooks/useMediaQuery', () => ({
  useIsMobile: () => true,
  useMediaQuery: () => true,
}));

const openDoc = vi.fn();
let _opening = false;
vi.mock('../useDocFileOpen', () => ({
  useDocFileOpen: () => ({ opening: _opening, openDoc }),
}));

const timelineProps = vi.fn();
vi.mock('@/components/revisions/RevisionTimelineBody', () => ({
  RevisionTimelineBody: (props: Record<string, unknown>) => {
    timelineProps(props);
    return <div data-testid="timeline-body" />;
  },
}));

import { DocSheet } from '../DocSheet';

function makeItem(over: Partial<DocItem> = {}): DocItem {
  return {
    id: 'drg-1',
    number: 'DRG-1204',
    title: 'Culvert headwall details',
    revision: 'C',
    current: true,
    lotLabel: null,
    lotId: null,
    documentId: 'doc-1',
    fileUrl: 'https://store/doc-1.pdf',
    ...over,
  };
}

function renderSheet(item: DocItem = makeItem(), projectId: string | null = 'proj-1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = vi.fn();
  const result = render(
    <QueryClientProvider client={client}>
      <DocSheet item={item} projectId={projectId} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { ...result, onClose };
}

const ISSUES = {
  issues: [
    {
      id: 'issue-1',
      entityType: 'drawing',
      entityId: 'drg-1',
      revisionLabel: 'C',
      supersedesId: 'drg-0',
      reason: null,
      issuedAt: '2026-07-24T09:14:00.000Z',
      issuedBy: { id: 'u9', fullName: 'David Harding', email: 'david@example.com' },
      recipients: [],
    },
  ],
};

describe('DocSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _opening = false;
    apiGetMock.mockResolvedValue({ issues: [] });
  });

  it('heads the sheet with the document number and its current revision chip', async () => {
    renderSheet();
    expect(await screen.findByText('DRG-1204')).toBeInTheDocument();
    expect(screen.getByText('REV C — CURRENT')).toBeInTheDocument();
    expect(screen.getByText('Culvert headwall details')).toBeInTheDocument();
  });

  it('shows the superseded chip for an older revision', async () => {
    renderSheet(makeItem({ current: false, revision: 'B' }));
    expect(await screen.findByText('REV B — SUPERSEDED')).toBeInTheDocument();
  });

  it('attributes the current revision from the issue record', async () => {
    apiGetMock.mockResolvedValue(ISSUES);
    renderSheet();
    expect(await screen.findByText(/Issued .* by David Harding/)).toBeInTheDocument();
  });

  it('says nothing about who issued it when there is no issue record', async () => {
    apiGetMock.mockResolvedValue({ issues: [] });
    renderSheet();
    await screen.findByText('DRG-1204');
    expect(screen.queryByText(/^Issued /)).toBeNull();
  });

  // ── The one prominent action ──────────────────────────────────────────────

  it('opens the drawing file via the existing signed-URL idiom', async () => {
    renderSheet();
    fireEvent.click(await screen.findByRole('button', { name: /Open drawing DRG-1204/i }));
    expect(openDoc).toHaveBeenCalledWith('doc-1', 'https://store/doc-1.pdf');
  });

  it('spins that ONE button while the signed URL is minted', async () => {
    _opening = true;
    renderSheet();
    const button = await screen.findByRole('button', { name: /Open drawing/i });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Opening…');
  });

  // ── The history ───────────────────────────────────────────────────────────

  it('renders the SHARED timeline body against the drawing, with hideWhenDisabled', async () => {
    apiGetMock.mockResolvedValue(ISSUES);
    renderSheet();

    expect(await screen.findByTestId('timeline-body')).toBeInTheDocument();
    expect(screen.getByText('Revision history')).toBeInTheDocument();
    expect(timelineProps).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'proj-1',
        entityType: 'drawing',
        entityId: 'drg-1',
        currentUserId: 'user-me',
        hideWhenDisabled: true,
      }),
    );
  });

  it('drops the WHOLE history section — heading included — when governance is off', async () => {
    apiGetMock.mockRejectedValue(new FakeApiError(404));
    renderSheet();

    await screen.findByText('DRG-1204');
    await waitFor(() => expect(screen.queryByText('Revision history')).toBeNull());
    expect(screen.queryByTestId('timeline-body')).toBeNull();
    // The sheet still does its main job.
    expect(screen.getByRole('button', { name: /Open drawing/i })).toBeInTheDocument();
    expect(screen.getByText('REV C — CURRENT')).toBeInTheDocument();
  });

  it('renders no history section at all without a resolved project', async () => {
    renderSheet(makeItem(), null);
    await screen.findByText('DRG-1204');
    expect(screen.queryByText('Revision history')).toBeNull();
    expect(apiGetMock).not.toHaveBeenCalled();
  });

  // ── Read-only ─────────────────────────────────────────────────────────────

  it('carries NO upload / new-revision / supersede / delete / status affordance', async () => {
    apiGetMock.mockResolvedValue(ISSUES);
    renderSheet();
    await screen.findByTestId('timeline-body');

    expect(
      screen.queryByRole('button', {
        name: /upload|new revision|supersede|delete|change status|edit/i,
      }),
    ).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});

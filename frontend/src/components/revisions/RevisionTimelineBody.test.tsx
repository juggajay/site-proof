/**
 * Tests for RevisionTimelineBody — the ONE revision timeline implementation,
 * rendered by the desktop modal and the foreman shell's doc sheet alike.
 *
 * What is pinned here: the recipient state vocabulary (four distinct
 * timestamps, four distinct chips, "Opened, Not Acknowledged" never
 * abbreviated), who a recipient is called now the route returns the user
 * relation, the acknowledge button's visibility rules, and the flag-off branch
 * that separates the two surfaces (`hideWhenDisabled`).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { apiGetMock, apiPostMock, FakeApiError } = vi.hoisted(() => ({
  apiGetMock: vi.fn(),
  apiPostMock: vi.fn(),
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
  apiPost: apiPostMock,
  ApiError: FakeApiError,
}));

import { RevisionTimelineBody } from './RevisionTimelineBody';
import { RevisionTimelineModal } from './RevisionTimelineModal';
import type { RevisionAcknowledgement, RevisionIssue } from './revisionTimelineState';

function recipient(over: Partial<RevisionAcknowledgement> = {}): RevisionAcknowledgement {
  return {
    id: 'ack-1',
    userId: 'user-1',
    recipientEmail: null,
    notifiedAt: null,
    openedAt: null,
    acknowledgedAt: null,
    user: { id: 'user-1', fullName: 'Kane Mullins', email: 'kane@example.com' },
    ...over,
  };
}

function issue(over: Partial<RevisionIssue> = {}): RevisionIssue {
  return {
    id: 'issue-1',
    entityType: 'drawing',
    entityId: 'drg-1',
    revisionLabel: 'C',
    supersedesId: 'drg-0',
    reason: 'Headwall wing extended 600 mm',
    issuedAt: '2026-07-24T09:14:00.000Z',
    issuedBy: { id: 'user-9', fullName: 'David Harding', email: 'david@example.com' },
    recipients: [],
    ...over,
  };
}

function renderBody(props: Partial<React.ComponentProps<typeof RevisionTimelineBody>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RevisionTimelineBody
        projectId="proj-1"
        entityType="drawing"
        entityId="drg-1"
        currentUserId="user-1"
        {...props}
      />
    </QueryClientProvider>,
  );
}

describe('RevisionTimelineBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiGetMock.mockResolvedValue({ issues: [] });
  });

  it('renders the issue heading, issuer and reason', async () => {
    apiGetMock.mockResolvedValue({ issues: [issue()] });
    renderBody();

    expect(await screen.findByText(/Rev C — superseded the previous revision/)).toBeInTheDocument();
    expect(screen.getByText('Issued by David Harding')).toBeInTheDocument();
    expect(screen.getByText(/Headwall wing extended 600 mm/)).toBeInTheDocument();
  });

  it('calls a first issue a first issue', async () => {
    apiGetMock.mockResolvedValue({ issues: [issue({ supersedesId: null, reason: null })] });
    renderBody();
    expect(await screen.findByText(/Rev C — first issue/)).toBeInTheDocument();
  });

  // ── The recipient vocabulary ──────────────────────────────────────────────

  it('names internal recipients from the user relation, not "Project member"', async () => {
    apiGetMock.mockResolvedValue({
      issues: [issue({ recipients: [recipient({ acknowledgedAt: '2026-07-24T10:00:00.000Z' })] })],
    });
    renderBody();

    expect(await screen.findByText('Kane Mullins')).toBeInTheDocument();
    expect(screen.queryByText('Project member')).toBeNull();
  });

  it('falls back to the external email, then to "Project member"', async () => {
    apiGetMock.mockResolvedValue({
      issues: [
        issue({
          recipients: [
            recipient({ id: 'a', userId: null, user: null, recipientEmail: 'ext@sub.com' }),
            recipient({ id: 'b', userId: null, user: null, recipientEmail: null }),
          ],
        }),
      ],
    });
    renderBody();

    expect(await screen.findByText('ext@sub.com')).toBeInTheDocument();
    expect(screen.getByText('Project member')).toBeInTheDocument();
  });

  it('renders each of the four recipient states as its own chip', async () => {
    apiGetMock.mockResolvedValue({
      issues: [
        issue({
          recipients: [
            recipient({ id: 'a', acknowledgedAt: '2026-07-24T10:00:00.000Z' }),
            recipient({ id: 'b', openedAt: '2026-07-24T10:00:00.000Z' }),
            recipient({ id: 'c', notifiedAt: '2026-07-24T10:00:00.000Z' }),
            recipient({ id: 'd' }),
          ],
        }),
      ],
    });
    renderBody();

    expect(await screen.findByText('ACKNOWLEDGED')).toBeInTheDocument();
    expect(screen.getByText('OPENED, NOT ACKNOWLEDGED')).toBeInTheDocument();
    expect(screen.getByText('NOTIFIED, NOT OPENED')).toBeInTheDocument();
    expect(screen.getByText('RECORDED AS A RECIPIENT')).toBeInTheDocument();
  });

  it('never abbreviates "Opened, Not Acknowledged" into something that reads as an ack', async () => {
    apiGetMock.mockResolvedValue({
      issues: [issue({ recipients: [recipient({ openedAt: '2026-07-24T10:00:00.000Z' })] })],
    });
    renderBody();

    const chip = await screen.findByText('OPENED, NOT ACKNOWLEDGED');
    expect(chip.textContent).toContain('NOT ACKNOWLEDGED');
    // The bare word must never stand alone on an unacknowledged recipient.
    expect(screen.queryByText('ACKNOWLEDGED')).toBeNull();
  });

  // ── Acknowledge ───────────────────────────────────────────────────────────

  it('offers acknowledge to the signed-in recipient with an outstanding ack', async () => {
    apiGetMock.mockResolvedValue({
      issues: [issue({ recipients: [recipient({ userId: 'user-1' })] })],
    });
    renderBody({ currentUserId: 'user-1' });

    expect(
      await screen.findByRole('button', { name: /I acknowledge this revision/i }),
    ).toBeInTheDocument();
  });

  it('hides acknowledge once that user has already acknowledged', async () => {
    apiGetMock.mockResolvedValue({
      issues: [
        issue({
          recipients: [recipient({ userId: 'user-1', acknowledgedAt: '2026-07-24T10:00:00.000Z' })],
        }),
      ],
    });
    renderBody({ currentUserId: 'user-1' });

    await screen.findByText('Kane Mullins');
    expect(screen.queryByRole('button', { name: /I acknowledge/i })).toBeNull();
  });

  it('hides acknowledge from someone the revision was not addressed to', async () => {
    apiGetMock.mockResolvedValue({
      issues: [issue({ recipients: [recipient({ userId: 'someone-else' })] })],
    });
    renderBody({ currentUserId: 'user-1' });

    await screen.findByText('Kane Mullins');
    expect(screen.queryByRole('button', { name: /I acknowledge/i })).toBeNull();
  });

  it('hides acknowledge when nobody is signed in', async () => {
    apiGetMock.mockResolvedValue({
      issues: [issue({ recipients: [recipient({ userId: 'user-1' })] })],
    });
    renderBody({ currentUserId: null });

    await screen.findByText('Kane Mullins');
    expect(screen.queryByRole('button', { name: /I acknowledge/i })).toBeNull();
  });

  it('posts the acknowledgement for the issue', async () => {
    apiGetMock.mockResolvedValue({
      issues: [issue({ recipients: [recipient({ userId: 'user-1' })] })],
    });
    apiPostMock.mockResolvedValue({});
    renderBody({ currentUserId: 'user-1' });

    (await screen.findByRole('button', { name: /I acknowledge this revision/i })).click();
    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith('/api/revisions/issue-1/acknowledge'),
    );
  });

  // ── Read-only everywhere else ─────────────────────────────────────────────

  it('offers no upload / supersede / delete / status affordance', async () => {
    apiGetMock.mockResolvedValue({
      issues: [issue({ recipients: [recipient({ userId: 'user-1' })] })],
    });
    renderBody({ currentUserId: 'user-1' });

    await screen.findByText('Kane Mullins');
    expect(
      screen.queryByRole('button', {
        name: /upload|supersede|delete|new revision|change status/i,
      }),
    ).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  // ── States ────────────────────────────────────────────────────────────────

  it('states the pre-adoption empty case without implying the revision was never issued', async () => {
    apiGetMock.mockResolvedValue({ issues: [] });
    renderBody();
    expect(
      await screen.findByText(/an absent record does not mean the revision was never issued/i),
    ).toBeInTheDocument();
  });

  it('reports a load failure honestly', async () => {
    apiGetMock.mockRejectedValue(new FakeApiError(500));
    renderBody();
    expect(await screen.findByText('Could not load the revision history.')).toBeInTheDocument();
  });

  it('tells a DESKTOP reader that governance is off (404)', async () => {
    apiGetMock.mockRejectedValue(new FakeApiError(404));
    renderBody();
    expect(
      await screen.findByText('Revision governance is not enabled in this environment.'),
    ).toBeInTheDocument();
  });

  it('renders NOTHING at all when governance is off and hideWhenDisabled is set', async () => {
    apiGetMock.mockRejectedValue(new FakeApiError(404));
    const { container } = renderBody({ hideWhenDisabled: true });

    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(screen.queryByText(/not enabled in this environment/i)).toBeNull();
  });

  it('still renders the timeline with hideWhenDisabled when governance is ON', async () => {
    apiGetMock.mockResolvedValue({ issues: [issue()] });
    renderBody({ hideWhenDisabled: true });
    expect(await screen.findByText(/Rev C —/)).toBeInTheDocument();
  });
});

describe('RevisionTimelineModal (desktop shell over the same body)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the SAME body inside the modal — one implementation, two shells', async () => {
    apiGetMock.mockResolvedValue({
      issues: [issue({ recipients: [recipient({ acknowledgedAt: '2026-07-24T10:00:00.000Z' })] })],
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <RevisionTimelineModal
          projectId="proj-1"
          entityType="drawing"
          entityId="drg-1"
          recordLabel="DRG-1204"
          currentUserId="user-1"
          onClose={vi.fn()}
        />
      </QueryClientProvider>,
    );

    expect(await screen.findByText(/Rev C — superseded the previous revision/)).toBeInTheDocument();
    expect(screen.getByText('Kane Mullins')).toBeInTheDocument();
    expect(screen.getByText('ACKNOWLEDGED')).toBeInTheDocument();
    expect(screen.getByText(/Revision history — DRG-1204/)).toBeInTheDocument();
  });

  it('reads the same query key the sheet reads — one fetch, not two', async () => {
    apiGetMock.mockResolvedValue({ issues: [issue()] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <RevisionTimelineModal
          projectId="proj-1"
          entityType="drawing"
          entityId="drg-1"
          recordLabel="DRG-1204"
          currentUserId="user-1"
          onClose={vi.fn()}
        />
        <RevisionTimelineBody
          projectId="proj-1"
          entityType="drawing"
          entityId="drg-1"
          currentUserId="user-1"
        />
      </QueryClientProvider>,
    );

    await screen.findAllByText(/Rev C —/);
    expect(apiGetMock).toHaveBeenCalledTimes(1);
  });
});

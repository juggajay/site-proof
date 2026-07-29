// Wave D `D1c.3` — the handover export UI, and the three things it must not
// get wrong (spec §4.7.6, §9).
//
// PROOF OF CATCH. Each block below fails against a page that does the plausible
// wrong thing:
//
//  1. ROLE GATE — a `site_manager` is inside the project and inside
//     `INTERNAL_ROLES`, so any guard looser than the backend's four-role list
//     lets them in. The positive control (`quality_manager` renders) is what
//     stops the gate being "deny everyone".
//  2. PREFLIGHT HONESTY — the over-cap refusal is a 400, and a page that treats
//     400 as a generic failure shows a red toast and loses the estimate, the
//     unmeasured count, the assumption and the narrower scope. The within-cap
//     control asserts the N-archives sentence is not simply hardcoded.
//  3. FAILURE / EXPIRY — `lastFailureReason` and an elapsed `expiresAt` both
//     render honestly, and an expired archive offers no download button.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders, screen, userEvent, waitFor } from '@/test/renderWithProviders';

const authState = vi.hoisted(() => ({
  user: { id: 'user-1', email: 'qm@example.com' } as Record<string, unknown> | null,
}));
const projectAccessState = vi.hoisted(() => ({ role: 'quality_manager' }));
const apiFetchMock = vi.hoisted(() => vi.fn());
const authFetchMock = vi.hoisted(() => vi.fn());
const viewportState = vi.hoisted(() => ({ isMobile: false }));

// jsdom has no matchMedia. Driving `useIsMobile` from state lets the same
// fixtures assert BOTH responsive branches.
vi.mock('@/hooks/useMediaQuery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useMediaQuery')>();
  return { ...actual, useIsMobile: () => viewportState.isMobile };
});

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: authState.user, loading: false, sessionExpired: false }),
  getAuthToken: () => 'test-token',
}));

// Keep the real ApiError — the refusal path parses the server body through it.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: apiFetchMock, authFetch: authFetchMock };
});

vi.mock('@/hooks/useProjectAccess', () => ({
  useProjectAccess: () => ({
    data: { role: projectAccessState.role, hasProjectAccess: true, isProjectAdmin: false },
    isLoading: false,
    error: null,
  }),
}));

// Real router (MemoryRouter, Link) with the project route param pinned, as if
// mounted at /projects/p1/handover-exports.
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useParams: () => ({ projectId: 'p1' }) };
});

import { ApiError } from '@/lib/api';
import { HANDOVER_EXPORT_ROLES } from '@/appRouteRoles';
import { ProjectProtectedRoute } from '@/components/auth/ProjectProtectedRoute';
import { HandoverExportPage } from './HandoverExportPage';
import type { HandoverExportRow } from './handoverExportData';

const ASSUMPTION =
  '6 member(s) have no stored byte size — hold-point signature and evidence pointers are bare ' +
  'strings and some documents predate size capture. Each was counted at a conservative ceiling: ' +
  '1 MiB for a signature (the JSON body limit that carried it) and 50 MiB for anything else (the ' +
  'document upload limit). The real total is very likely smaller.';

const OVER_CAP_MESSAGE =
  'This scope is estimated at 47.3 GiB, over the 7.9 GiB limit for one archive. 812 of 50000 ' +
  'files could not be measured and were counted conservatively. At this limit the scope needs ' +
  'about 6 archives — request them by area or by lot range, and each one arrives complete with ' +
  'its own manifest.';

function exportRow(overrides: Partial<HandoverExportRow> = {}): HandoverExportRow {
  return {
    id: 'exp-1',
    projectId: 'p1',
    scope: { kind: 'project' },
    status: 'complete',
    requestedAt: '2026-07-20T01:00:00.000Z',
    requestedById: 'user-1',
    snapshotCutoffAt: '2026-07-20T01:00:00.000Z',
    totalMembers: 240,
    processedMembers: 240,
    totalBytes: '1288490188',
    fileSize: '1200000000',
    sha256: 'a'.repeat(64),
    lastFailureReason: null,
    completedAt: '2026-07-20T01:30:00.000Z',
    expiresAt: '2099-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** A job mid-assembly: 142 of 320 members written, nothing published yet. */
function runningExport(): HandoverExportRow {
  return exportRow({
    id: 'exp-run',
    status: 'processing',
    processedMembers: 142,
    totalMembers: 320,
    fileSize: null,
    sha256: null,
    completedAt: null,
    expiresAt: null,
  });
}

/** Route `apiFetch` by path + method, the way the page actually calls it. */
function mockApi(options: {
  exports?: HandoverExportRow[];
  onCreate?: () => Promise<unknown>;
}): void {
  apiFetchMock.mockImplementation((path: string, init?: RequestInit) => {
    if (path.includes('/handover-exports') && init?.method === 'POST') {
      return options.onCreate?.() ?? Promise.reject(new Error('unexpected create in this fixture'));
    }
    if (path.includes('/handover-exports')) {
      return Promise.resolve({ exports: options.exports ?? [] });
    }
    if (path.includes('/areas')) {
      return Promise.resolve({ areas: [{ id: 'area-1', name: 'Stage 1' }] });
    }
    return Promise.resolve({});
  });
}

function renderGuardedPage() {
  return renderWithProviders(
    <ProjectProtectedRoute allowedRoles={HANDOVER_EXPORT_ROLES}>
      <HandoverExportPage />
    </ProjectProtectedRoute>,
    { initialEntries: ['/projects/p1/handover-exports'] },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.user = { id: 'user-1', email: 'qm@example.com' };
  projectAccessState.role = 'quality_manager';
  viewportState.isMobile = false;
  mockApi({});
});

describe('handover export role gate', () => {
  it('mirrors the backend requester set exactly', () => {
    // `backend/src/routes/handoverExports/access.ts:27`. Written as a literal so
    // widening the frontend gate without the backend fails here.
    expect(HANDOVER_EXPORT_ROLES).toEqual(['owner', 'admin', 'project_manager', 'quality_manager']);
  });

  it('blocks a site manager from the route even though they are on the project', async () => {
    projectAccessState.role = 'site_manager';

    renderGuardedPage();

    expect(await screen.findByText(/do not have permission to access this page/i)).toBeVisible();
    expect(screen.queryByRole('heading', { name: /handover export/i })).not.toBeInTheDocument();
  });

  it('renders the surface for a quality manager', async () => {
    renderGuardedPage();

    expect(await screen.findByRole('heading', { name: /handover export/i })).toBeVisible();
  });
});

describe('handover export preflight', () => {
  it('states how many archives an over-cap scope implies, with the refusal as the next step', async () => {
    mockApi({
      onCreate: () =>
        Promise.reject(
          new ApiError(
            400,
            JSON.stringify({
              error: {
                message: OVER_CAP_MESSAGE,
                code: 'HANDOVER_EXPORT_OVER_CAP',
                details: {
                  estimatedInputBytes: '50800000000',
                  measuredBytes: '50000000000',
                  memberCount: 50000,
                  unmeasuredMemberCount: 812,
                  unmeasuredAssumption: ASSUMPTION,
                  admissionCapBytes: 8504437146,
                  memberCountLimit: 8334,
                  archivesImpliedAtCap: 6,
                  scopeKind: 'project',
                },
              },
            }),
          ),
        ),
    });

    const { user } = await renderAndRequest();

    expect(await screen.findByText(/this scope will produce 6 archives/i)).toBeVisible();
    // The backend's sentence, rendered — not paraphrased.
    expect(screen.getByText(OVER_CAP_MESSAGE)).toBeVisible();
    expect(screen.getByText(ASSUMPTION)).toBeVisible();
    // The named narrower scope is an action, not a dead end.
    const narrow = screen.getByRole('button', { name: /narrow to one area/i });
    expect(narrow).toBeVisible();
    await user.click(narrow);
    expect(await screen.findByLabelText('Area')).toBeVisible();
  });

  it('states the estimate, the unmeasured count and the assumption when the scope fits', async () => {
    mockApi({
      onCreate: () =>
        Promise.resolve({
          id: 'exp-new',
          status: 'queued',
          lotCount: 40,
          snapshotCutoffAt: '2026-07-29T01:00:00.000Z',
          preflight: {
            estimatedInputBytes: '1288490188',
            measuredBytes: '1234000000',
            memberCount: 240,
            unmeasuredMemberCount: 6,
            unmeasuredAssumption: ASSUMPTION,
            admissionCapBytes: 8504437146,
            archivesImpliedAtCap: 1,
          },
        }),
    });

    await renderAndRequest();

    expect(await screen.findByText(/this scope will produce 1 archive\./i)).toBeVisible();
    // Truncated, not rounded — the same arithmetic the backend's `formatBytes`
    // uses, so our line and the server's refusal sentence cannot disagree.
    expect(screen.getByText(/1\.1 GiB/)).toBeVisible();
    expect(screen.getByText(/6 of 240 files could not be measured/i)).toBeVisible();
    expect(screen.getByText(ASSUMPTION)).toBeVisible();
  });

  it('nudges about folio coverage without blocking the export', async () => {
    renderGuardedPage();

    expect(
      await screen.findByRole('link', { name: /issue folios from the lot list/i }),
    ).toHaveAttribute('href', '/projects/p1/lots');
  });
});

describe('handover export job states', () => {
  it('renders a failed job reason in plain English, with no raw enum', async () => {
    mockApi({
      exports: [
        exportRow({
          id: 'exp-failed',
          status: 'failed',
          processedMembers: 12,
          fileSize: null,
          sha256: null,
          completedAt: null,
          expiresAt: null,
          lastFailureReason: 'Storage object missing for 3 members after 5 attempts',
        }),
      ],
    });

    renderGuardedPage();

    expect(await screen.findByText('Failed')).toBeVisible();
    expect(
      screen.getByText(/storage object missing for 3 members after 5 attempts/i),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: /download archive/i })).not.toBeInTheDocument();
  });

  it('renders an expired archive as expired, not as an error, and offers no download', async () => {
    mockApi({
      exports: [exportRow({ id: 'exp-old', expiresAt: '2026-07-01T00:00:00.000Z' })],
    });

    renderGuardedPage();

    expect(await screen.findByText(/archive expired/i)).toBeVisible();
    expect(screen.getByText(/request again/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: /download archive/i })).not.toBeInTheDocument();
  });

  it('shows progress and a cancel action while a job is running', async () => {
    mockApi({ exports: [runningExport()] });

    renderGuardedPage();

    expect(await screen.findByText('142 of 320 files')).toBeVisible();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeVisible();
  });

  it('keeps the same job facts on the mobile card layout', async () => {
    viewportState.isMobile = true;
    mockApi({ exports: [runningExport()] });

    renderGuardedPage();

    expect(await screen.findByText('142 of 320 files')).toBeVisible();
    expect(screen.getByText('Processing')).toBeVisible();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeVisible();
  });
});

/** Render, keep the default (whole-project) scope, and submit. */
async function renderAndRequest() {
  const user = userEvent.setup();
  renderGuardedPage();
  const button = await screen.findByRole('button', { name: /check size and request/i });
  await user.click(button);
  await waitFor(() =>
    expect(
      apiFetchMock.mock.calls.some(
        (call) => (call[1] as RequestInit | undefined)?.method === 'POST',
      ),
    ).toBe(true),
  );
  return { user };
}

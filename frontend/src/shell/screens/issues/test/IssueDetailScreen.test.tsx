/**
 * Tests for IssueDetailScreen — renders the description + evidence photo strip,
 * and proves the permission gate (research doc 14, BINDING):
 *   - "Respond" is shown ONLY when the foreman is the NCR's responsibleUserId
 *     (both directions asserted),
 *   - there is NO Close / QM affordance anywhere on the screen.
 *
 * MOCKS @/lib/useOfflineStatus because ShellScreen mounts SyncChip. The evidence
 * + respond hooks are mocked so the detail render is deterministic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { NCR } from '@/pages/ncr/types';
import type { IssuesShellData } from '../useIssuesShellData';
import type { NcrEvidenceItem } from '../useNcrEvidence';

vi.mock('@/lib/documentAccess', () => ({
  openDocumentAccessUrl: vi.fn(async () => undefined),
}));

vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOnline: true, pendingSyncCount: 0, isSyncing: false }),
}));

let _userId: string | null = 'user-me';
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: _userId ? { id: _userId, fullName: 'Jay' } : null }),
}));

vi.mock('@/components/documents/SecureDocumentImage', () => ({
  SecureDocumentImage: ({
    documentId,
    fileUrl,
    alt,
    className,
  }: {
    documentId: string;
    fileUrl?: string | null;
    alt?: string;
    className?: string;
  }) => (
    <img
      src={`/secure-doc/${documentId}`}
      data-file-url={fileUrl}
      alt={alt}
      className={className}
    />
  ),
}));

let _photos: NcrEvidenceItem[] = [];
let _evidence: NcrEvidenceItem[] = [];
vi.mock('../useNcrEvidence', () => ({
  useNcrEvidence: () => ({
    evidence: _evidence,
    photos: _photos,
    evidenceLoading: false,
    uploading: false,
    addPhoto: vi.fn(),
  }),
}));
vi.mock('../useNcrRespond', () => ({
  useNcrRespond: () => ({ submitting: false, respond: vi.fn() }),
}));

let _data: IssuesShellData;
vi.mock('../issuesShellContext', () => ({
  useIssuesShellContext: () => _data,
}));

import { IssueDetailScreen } from '../IssueDetailScreen';
import { openDocumentAccessUrl } from '@/lib/documentAccess';

function makeNcr(over: Partial<NCR>): NCR {
  return {
    id: 'n1',
    ncrNumber: 'NCR-042',
    description: 'Slump out of spec on pour 3',
    category: 'materials',
    severity: 'major',
    status: 'open',
    qmApprovalRequired: true,
    qmApprovedAt: null,
    raisedBy: { fullName: 'Jay', email: 'jay@x.com' },
    responsibleUser: null,
    responsibleUserId: null,
    createdAt: '2026-06-10T08:00:00Z',
    dueDate: '2026-06-20T00:00:00Z',
    project: { name: 'Demo', projectNumber: 'P1' },
    ncrLots: [],
    ...over,
  } as NCR;
}

function makeData(ncr: NCR | null): IssuesShellData {
  return {
    projectId: 'proj-1',
    ncrs: ncr ? [ncr] : [],
    loading: false,
    loadError: null,
    openCount: 0,
    refetch: vi.fn(),
  };
}

function renderScreen(ncrId = 'n1') {
  return render(
    <MemoryRouter initialEntries={[`/m/issues/${ncrId}`]}>
      <Routes>
        <Route path="/m/issues/:ncrId" element={<IssueDetailScreen />} />
        <Route path="/m/issues" element={<div>issues list</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const photo = (over: Partial<NcrEvidenceItem> = {}): NcrEvidenceItem => ({
  id: 'e1',
  evidenceType: 'photo',
  document: {
    id: 'd1',
    filename: 'pour3.jpg',
    fileUrl: 'https://storage/pour3.jpg',
    caption: 'slump cone',
  },
  ...over,
});

const documentEvidence = (over: Partial<NcrEvidenceItem> = {}): NcrEvidenceItem => ({
  id: 'e-doc-1',
  evidenceType: 'certificate',
  document: {
    id: 'doc-cert-1',
    filename: 'compaction-cert.pdf',
    fileUrl: null,
    mimeType: 'application/pdf',
    caption: null,
  },
  ...over,
});

describe('IssueDetailScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _userId = 'user-me';
    _photos = [];
    _evidence = [];
  });

  it('renders the description, mono number and severity/status pills', () => {
    _data = makeData(makeNcr({}));
    renderScreen();
    expect(screen.getByText('NCR-042')).toBeInTheDocument();
    expect(screen.getByText(/Slump out of spec on pour 3/)).toBeInTheDocument();
    expect(screen.getByText('MAJOR')).toBeInTheDocument();
    expect(screen.getByText('OPEN')).toBeInTheDocument();
  });

  it('renders the evidence photo strip from existing evidence data', () => {
    _photos = [photo()];
    _evidence = _photos;
    _data = makeData(makeNcr({}));
    renderScreen();
    const img = screen.getByAltText('slump cone') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/secure-doc/d1');
    expect(img).toHaveAttribute('data-file-url', 'https://storage/pour3.jpg');
  });

  it('renders sanitized evidence photos using document id when raw fileUrl is omitted', () => {
    _photos = [photo({ document: { id: 'd2', filename: 'sanitized.jpg', caption: null } })];
    _evidence = _photos;
    _data = makeData(makeNcr({}));
    renderScreen();
    const img = screen.getByAltText('sanitized.jpg') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/secure-doc/d2');
    expect(img).not.toHaveAttribute('data-file-url');
  });

  it('opens sanitized evidence photos through the signed document helper', () => {
    _photos = [photo({ document: { id: 'd3', filename: 'openable.jpg', caption: null } })];
    _evidence = _photos;
    _data = makeData(makeNcr({}));
    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: /Open openable\.jpg/i }));

    expect(openDocumentAccessUrl).toHaveBeenCalledWith('d3', undefined);
  });

  it('renders and opens non-photo evidence documents', () => {
    _evidence = [documentEvidence()];
    _data = makeData(makeNcr({}));
    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: /compaction-cert\.pdf/i }));

    expect(screen.getByText('certificate')).toBeInTheDocument();
    expect(openDocumentAccessUrl).toHaveBeenCalledWith('doc-cert-1', null);
  });

  it('shows an Add photo affordance (foreman adds evidence)', () => {
    _data = makeData(makeNcr({}));
    renderScreen();
    expect(screen.getByRole('button', { name: /Add photo/i })).toBeInTheDocument();
  });

  it('shows Respond ONLY when the foreman is the responsible user', () => {
    _data = makeData(makeNcr({ responsibleUserId: 'user-me' }));
    renderScreen();
    expect(screen.getByRole('button', { name: /Respond to NCR-042/i })).toBeInTheDocument();
  });

  it('does NOT show Respond when the foreman is not the responsible user', () => {
    _data = makeData(makeNcr({ responsibleUserId: 'someone-else' }));
    renderScreen();
    expect(screen.queryByRole('button', { name: /Respond/i })).toBeNull();
  });

  it('does NOT show Respond when the NCR is closed even if responsible', () => {
    _data = makeData(makeNcr({ responsibleUserId: 'user-me', status: 'closed' }));
    renderScreen();
    expect(screen.queryByRole('button', { name: /Respond/i })).toBeNull();
  });

  it('has NO close / QM affordance anywhere (foreman never closes)', () => {
    _data = makeData(makeNcr({ responsibleUserId: 'user-me' }));
    renderScreen();
    expect(screen.queryByRole('button', { name: /close|verify|concession|qm/i })).toBeNull();
  });
});

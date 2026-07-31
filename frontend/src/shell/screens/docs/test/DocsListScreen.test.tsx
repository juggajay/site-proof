/**
 * Tests for DocsListScreen — register cards with mono number + title, the green
 * "REV X — CURRENT" / muted "SUPERSEDED" pill (superseded sorted below current),
 * the lot chip vs PROJECT-WIDE pill, loading/error/empty states, the ?lotId=
 * deep-link filter, the viewer invocation (taps open the file via the existing
 * signed-URL idiom), and the ABSENCE of any upload/revision/supersede/delete
 * affordance (foreman is VIEW only — research doc 14).
 *
 * MOCKS @/lib/useOfflineStatus (Dexie/IndexedDB) because ShellScreen mounts
 * SyncChip → useOfflineStatus. The file opener (useDocFileOpen) is mocked so we
 * can assert taps invoke it with the document id + url.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { DocsShellData } from '../useDocsShellData';
import type { DocItem } from '../docsShellState';

vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOnline: true, pendingSyncCount: 0, isSyncing: false }),
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'user-me', fullName: 'Jay', roleInCompany: 'foreman' } }),
}));
vi.mock('@/hooks/useEffectiveProjectId', () => ({
  useEffectiveProjectId: () => ({ projectId: 'proj-1', isResolving: false }),
}));

const openDoc = vi.fn();
vi.mock('../useDocFileOpen', () => ({
  useDocFileOpen: () => ({ opening: false, openDoc }),
}));

// The sheet is the card's destination and has its own test file; here we only
// care THAT a tap opens it, and with which document.
const docSheetProps = vi.fn();
vi.mock('../DocSheet', () => ({
  DocSheet: (props: { item: DocItem }) => {
    docSheetProps(props);
    return <div data-testid="doc-sheet">{props.item.number}</div>;
  },
}));

let _data: DocsShellData;
vi.mock('../docsShellContext', () => ({
  useDocsShellContext: () => _data,
}));

import { DocsListScreen } from '../DocsListScreen';
import { currentDocCount } from '../docsShellState';

function makeItem(over: Partial<DocItem> = {}): DocItem {
  return {
    id: 'd1',
    number: 'DRG-1204',
    title: 'Embankment typical sections',
    revision: 'C',
    current: true,
    lotLabel: null,
    lotId: null,
    documentId: 'doc-1',
    fileUrl: 'https://store/doc-1.pdf',
    ...over,
  };
}

function makeData(items: DocItem[], over: Partial<DocsShellData> = {}): DocsShellData {
  return {
    projectId: 'proj-1',
    items,
    loading: false,
    loadError: null,
    currentCount: currentDocCount(items),
    refetch: vi.fn(),
    ...over,
  };
}

function renderScreen(entry = '/m/docs') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/m/docs" element={<DocsListScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DocsListScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the mono number, title and green CURRENT revision pill', () => {
    _data = makeData([makeItem()]);
    renderScreen();
    expect(screen.getByText('DRG-1204')).toBeInTheDocument();
    expect(screen.getByText(/Embankment typical sections/)).toBeInTheDocument();
    expect(screen.getByText('REV C — CURRENT')).toBeInTheDocument();
  });

  // ── Card rules (G1): icon + one label + ONE chip + chevron ────────────────

  it('carries a leading icon and a chevron, with the whole card as one target', () => {
    _data = makeData([makeItem()]);
    const { container } = renderScreen();

    const card = screen.getByRole('button', { name: /DRG-1204/ });
    expect(card.querySelector('.shell-hub-ico')).not.toBeNull();
    expect(card.querySelectorAll('svg').length).toBe(2); // leading icon + chevron
    // No nested action: the card itself is the only button on the card.
    expect(card.querySelectorAll('button').length).toBe(0);
    expect(container.querySelectorAll('.shell-card').length).toBe(1);
  });

  it('renders exactly ONE chip per card — the second pill is gone', () => {
    _data = makeData([makeItem({ lotLabel: 'LOT-001', lotId: 'lot-1' })]);
    renderScreen();

    const card = screen.getByRole('button', { name: /DRG-1204/ });
    expect(card.querySelectorAll('.shell-pill').length).toBe(1);
    expect(screen.queryByText('PROJECT-WIDE')).toBeNull();
    expect(screen.queryByText('LOT-001')).toBeNull();
  });

  it('drops the lot pill even when the drawing has no lot link at all', () => {
    _data = makeData([makeItem({ lotLabel: null, lotId: null })]);
    renderScreen();
    const card = screen.getByRole('button', { name: /DRG-1204/ });
    expect(card.querySelectorAll('.shell-pill').length).toBe(1);
    expect(screen.queryByText('PROJECT-WIDE')).toBeNull();
  });

  it('keeps the card tappable while a signed URL is being minted', () => {
    // Regression guard: minting used to disable EVERY card on the list. The
    // spinner now belongs to one button inside the sheet.
    _data = makeData([makeItem()]);
    renderScreen();
    expect(screen.getByRole('button', { name: /DRG-1204/ })).not.toBeDisabled();
  });

  it('renders a muted SUPERSEDED pill for a superseded revision', () => {
    _data = makeData([makeItem({ id: 's', number: 'DRG-1209', current: false, revision: 'A' })]);
    renderScreen();
    expect(screen.getByText('REV A — SUPERSEDED')).toBeInTheDocument();
  });

  it('opens the document sheet on tap — not the file directly', () => {
    _data = makeData([makeItem()]);
    renderScreen();

    expect(screen.queryByTestId('doc-sheet')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /DRG-1204/ }));

    expect(screen.getByTestId('doc-sheet')).toBeInTheDocument();
    expect(docSheetProps).toHaveBeenCalledWith(
      expect.objectContaining({
        item: expect.objectContaining({ id: 'd1', documentId: 'doc-1' }),
        projectId: 'proj-1',
      }),
    );
    // The list itself never mints the signed URL any more.
    expect(openDoc).not.toHaveBeenCalled();
  });

  it('closes the sheet again', () => {
    _data = makeData([makeItem()]);
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /DRG-1204/ }));

    const { onClose } = docSheetProps.mock.calls.at(-1)![0];
    act(() => onClose());
    expect(screen.queryByTestId('doc-sheet')).toBeNull();
  });

  it('shows a loading skeleton', () => {
    _data = makeData([], { loading: true });
    const { container } = renderScreen();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows the load-error message with a retry', () => {
    const refetch = vi.fn();
    _data = makeData([], { loadError: 'Couldn’t load drawings.', refetch });
    renderScreen();
    expect(screen.getByText('Couldn’t load drawings.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('shows the empty state when the register is empty', () => {
    _data = makeData([]);
    renderScreen();
    expect(screen.getByText(/No drawings in the register yet/i)).toBeInTheDocument();
  });

  it('keeps project-wide drawings visible via the ?lotId= deep-link', () => {
    // The register is project-scoped today, so project-wide drawings are still
    // relevant when a lot hub links into the drawings surface.
    _data = makeData([makeItem({ lotId: null })]);
    renderScreen('/m/docs?lotId=lot-77');
    expect(screen.getByText('DRG-1204')).toBeInTheDocument();
    expect(screen.getByText('REV C — CURRENT')).toBeInTheDocument();
  });

  it('shows matching lot drawings and project-wide drawings when lot-linked', () => {
    _data = makeData([
      makeItem({ id: 'a', number: 'DRG-1', lotId: 'lot-77', lotLabel: 'LOT-077' }),
      makeItem({ id: 'b', number: 'DRG-2', lotId: 'lot-99', lotLabel: 'LOT-099' }),
      makeItem({ id: 'c', number: 'DRG-3', lotId: null, lotLabel: null }),
    ]);
    renderScreen('/m/docs?lotId=lot-77');
    expect(screen.getByText('DRG-1')).toBeInTheDocument();
    expect(screen.getByText('DRG-3')).toBeInTheDocument();
    expect(screen.queryByText('DRG-2')).toBeNull();
  });

  it('shows a search box once the register is long, and filters by it', () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      makeItem({ id: `d${i}`, number: `DRG-${1000 + i}`, title: `Sheet ${i}` }),
    );
    _data = makeData(items);
    renderScreen();
    const box = screen.getByRole('searchbox', { name: /search drawings/i });
    fireEvent.change(box, { target: { value: 'DRG-1003' } });
    expect(screen.getByText('DRG-1003')).toBeInTheDocument();
    expect(screen.queryByText('DRG-1004')).toBeNull();
  });

  it('does NOT show a search box for a short register', () => {
    _data = makeData([makeItem(), makeItem({ id: 'd2', number: 'DRG-2' })]);
    renderScreen();
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  it('has NO upload / new-revision / supersede / delete / status affordance (VIEW only)', () => {
    _data = makeData([makeItem(), makeItem({ id: 's', number: 'DRG-2', current: false })]);
    renderScreen();
    // Note: the doc cards are themselves buttons whose accessible name includes
    // "superseded" (the revision state) — so we match the desktop register's
    // management VERBS, which never appear on this VIEW-only surface.
    expect(
      screen.queryByRole('button', {
        name: /upload|add drawing|new revision|delete|change status|more actions/i,
      }),
    ).toBeNull();
    // No status <select> either (the desktop register's status dropdown).
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});

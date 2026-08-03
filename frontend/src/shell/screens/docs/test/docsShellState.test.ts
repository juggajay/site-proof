/**
 * Exhaustive unit tests for the pure Drawings & Docs shell state helpers:
 * current-revision detection, the projection of BOTH sources (drawing register
 * rows and lot-filed drawing documents) + the merge/dedupe, current-first
 * ordering, the lot filter, search, counts, and the revision pill label.
 */
import { describe, it, expect } from 'vitest';
import {
  currentDocCount,
  filterDocsByLot,
  isCurrentDrawing,
  revisionPillLabel,
  searchDocs,
  sortDocsCurrentFirst,
  toDocItems,
  type DocItem,
  type DrawingDocumentRow,
  type DrawingRegisterRow,
} from '../docsShellState';

function row(over: Partial<DrawingRegisterRow> = {}): DrawingRegisterRow {
  return {
    id: 'd1',
    drawingNumber: 'DRG-1204',
    title: 'Embankment typical sections',
    revision: 'C',
    status: 'for_construction',
    document: { id: 'doc-1', fileUrl: 'https://store/doc-1.pdf' },
    supersededBy: null,
    ...over,
  };
}

function docRow(over: Partial<DrawingDocumentRow> = {}): DrawingDocumentRow {
  return {
    id: 'document-1',
    filename: 'Sheet-05-pavement.pdf',
    caption: 'Pavement sheet for the lot',
    supersededById: null,
    lotId: 'lot-1',
    lot: { id: 'lot-1', lotNumber: 'LOT-001' },
    ...over,
  };
}

function item(over: Partial<DocItem> = {}): DocItem {
  return {
    id: 'd1',
    source: 'register',
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

describe('isCurrentDrawing', () => {
  it('is current when nothing supersedes the row', () => {
    expect(isCurrentDrawing({ supersededBy: null })).toBe(true);
  });

  it('is NOT current once a newer revision supersedes it', () => {
    expect(
      isCurrentDrawing({ supersededBy: { id: 'd2', drawingNumber: 'DRG-1204', revision: 'D' } }),
    ).toBe(false);
  });
});

describe('toDocItems projection', () => {
  it('projects the register fields onto the DocItem shape', () => {
    const [it] = toDocItems([row()]);
    expect(it).toMatchObject({
      id: 'd1',
      source: 'register',
      number: 'DRG-1204',
      title: 'Embankment typical sections',
      revision: 'C',
      current: true,
      documentId: 'doc-1',
      fileUrl: 'https://store/doc-1.pdf',
    });
  });

  it('marks superseded rows as not current', () => {
    const [it] = toDocItems([
      row({ supersededBy: { id: 'x', drawingNumber: 'DRG-1204', revision: 'D' } }),
    ]);
    expect(it.current).toBe(false);
  });

  it('derives lotLabel/lotId from a lot relation when present, else null', () => {
    const withLot = toDocItems([row({ lot: { id: 'lot-9', lotNumber: 'LOT-009' } })])[0];
    expect(withLot.lotLabel).toBe('LOT-009');
    expect(withLot.lotId).toBe('lot-9');
    const withoutLot = toDocItems([row()])[0];
    expect(withoutLot.lotLabel).toBeNull();
    expect(withoutLot.lotId).toBeNull();
  });

  it('prefers an explicit lotId over the lot relation id', () => {
    const it = toDocItems([
      row({ lotId: 'explicit', lot: { id: 'rel', lotNumber: 'LOT-001' } }),
    ])[0];
    expect(it.lotId).toBe('explicit');
  });
});

describe('drawing-document projection', () => {
  it('projects a lot-filed drawing document onto the DocItem shape', () => {
    const [it] = toDocItems([], [docRow()]);
    expect(it).toEqual({
      id: 'document-1',
      source: 'document',
      number: 'Sheet-05-pavement.pdf',
      title: 'Pavement sheet for the lot',
      revision: null,
      current: true,
      lotLabel: 'LOT-001',
      lotId: 'lot-1',
      documentId: 'document-1',
      fileUrl: null,
    });
  });

  it('marks a formally superseded document as not current', () => {
    const [it] = toDocItems([], [docRow({ supersededById: 'document-2' })]);
    expect(it.current).toBe(false);
  });

  it('tolerates a document with no caption and no lot link', () => {
    const [it] = toDocItems([], [docRow({ caption: null, lotId: null, lot: null })]);
    expect(it.title).toBeNull();
    expect(it.lotId).toBeNull();
    expect(it.lotLabel).toBeNull();
  });

  it('falls back to the lot relation id when lotId is absent', () => {
    const [it] = toDocItems([], [docRow({ lotId: undefined })]);
    expect(it.lotId).toBe('lot-1');
  });
});

describe('toDocItems merge + dedupe', () => {
  it('merges register rows and drawing documents into one list', () => {
    const out = toDocItems([row({ id: 'd1', drawingNumber: 'DRG-1' })], [docRow({ id: 'doc-9' })]);
    expect(out.map((i) => i.id)).toEqual(['d1', 'doc-9']);
    expect(out.map((i) => i.number)).toEqual(['DRG-1', 'Sheet-05-pavement.pdf']);
    expect(out.map((i) => i.source)).toEqual(['register', 'document']);
  });

  it('drops the document that already backs a register row (no duplicate file)', () => {
    // Every register drawing is backed by a Document row, so the same file comes
    // back from BOTH endpoints — the register row must win.
    const out = toDocItems(
      [row({ id: 'd1', document: { id: 'doc-1' } })],
      [docRow({ id: 'doc-1', filename: 'DRG-1204-C.pdf' }), docRow({ id: 'doc-2' })],
    );
    expect(out).toHaveLength(2);
    expect(out.map((i) => i.documentId).sort()).toEqual(['doc-1', 'doc-2']);
    expect(out.find((i) => i.documentId === 'doc-1')).toMatchObject({
      source: 'register',
      number: 'DRG-1204',
      revision: 'C',
    });
  });

  it('orders the merged set current-first, then by number', () => {
    const out = toDocItems(
      [row({ id: 'd1', drawingNumber: 'DRG-9', document: { id: 'doc-1' } })],
      [
        docRow({ id: 'doc-a', filename: 'AAA.pdf', supersededById: 'doc-old' }),
        docRow({ id: 'doc-b', filename: 'BBB.pdf' }),
      ],
    );
    expect(out.map((i) => i.number)).toEqual(['BBB.pdf', 'DRG-9', 'AAA.pdf']);
  });

  it('defaults the document list to empty (register-only callers unchanged)', () => {
    expect(toDocItems([row()])).toHaveLength(1);
  });
});

describe('sortDocsCurrentFirst', () => {
  it('puts current revisions before superseded ones', () => {
    const out = sortDocsCurrentFirst([
      item({ id: 'a', number: 'DRG-1', current: false }),
      item({ id: 'b', number: 'DRG-2', current: true }),
    ]);
    expect(out.map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('orders within a group by drawing number, numeric-aware (DRG-9 before DRG-10)', () => {
    const out = sortDocsCurrentFirst([
      item({ id: 'ten', number: 'DRG-10' }),
      item({ id: 'nine', number: 'DRG-9' }),
    ]);
    expect(out.map((i) => i.number)).toEqual(['DRG-9', 'DRG-10']);
  });

  it('is case-insensitive on the number', () => {
    const out = sortDocsCurrentFirst([
      item({ id: 'b', number: 'spec-b' }),
      item({ id: 'a', number: 'SPEC-A' }),
    ]);
    expect(out.map((i) => i.number)).toEqual(['SPEC-A', 'spec-b']);
  });

  it('falls back to a stable id tiebreak on equal numbers', () => {
    const out = sortDocsCurrentFirst([
      item({ id: 'z', number: 'DRG-1' }),
      item({ id: 'a', number: 'DRG-1' }),
    ]);
    expect(out.map((i) => i.id)).toEqual(['a', 'z']);
  });

  it('does not mutate the input array', () => {
    const input = [item({ id: 'a', current: false }), item({ id: 'b', current: true })];
    const snapshot = input.map((i) => i.id);
    sortDocsCurrentFirst(input);
    expect(input.map((i) => i.id)).toEqual(snapshot);
  });

  it('toDocItems applies the current-first ordering end to end', () => {
    const out = toDocItems([
      row({
        id: 'old',
        drawingNumber: 'DRG-1',
        supersededBy: { id: 'new', drawingNumber: 'DRG-1', revision: 'B' },
      }),
      row({ id: 'cur', drawingNumber: 'DRG-2', supersededBy: null }),
    ]);
    expect(out.map((i) => i.id)).toEqual(['cur', 'old']);
  });
});

describe('filterDocsByLot', () => {
  const items = [
    item({ id: 'a', lotId: 'lot-1', lotLabel: 'LOT-001' }),
    item({ id: 'b', lotId: 'lot-2', lotLabel: 'LOT-002' }),
    item({ id: 'c', lotId: null }),
  ];

  it('returns everything (a copy) when lotId is null/empty', () => {
    expect(filterDocsByLot(items, null).map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(filterDocsByLot(items, undefined).map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(filterDocsByLot(items, '')).toHaveLength(3);
  });

  it('keeps matching lot items and project-wide items for a lot deep-link', () => {
    expect(filterDocsByLot(items, 'lot-1').map((i) => i.id)).toEqual(['a', 'c']);
  });

  it('keeps project-wide drawings even when no lot-linked drawings match', () => {
    expect(filterDocsByLot(items, 'lot-unknown').map((i) => i.id)).toEqual(['c']);
  });

  it('does not mutate the input', () => {
    const snapshot = items.map((i) => i.id);
    filterDocsByLot(items, 'lot-1');
    expect(items.map((i) => i.id)).toEqual(snapshot);
  });

  it('really narrows a merged list to the lot — the deep-link is no longer a no-op', () => {
    // The regression this whole surface change exists for: lot linkage lives on
    // the DOCUMENT rows, so filtering only did something once they were merged.
    const merged = toDocItems(
      [row({ id: 'd1', drawingNumber: 'DRG-1', document: { id: 'doc-1' } })],
      [
        docRow({ id: 'doc-mine', filename: 'MINE.pdf', lotId: 'lot-1' }),
        docRow({
          id: 'doc-theirs',
          filename: 'THEIRS.pdf',
          lotId: 'lot-2',
          lot: { id: 'lot-2', lotNumber: 'LOT-002' },
        }),
      ],
    );

    const scoped = filterDocsByLot(merged, 'lot-1');
    // The lot's own drawing, plus the project-wide register row; not lot-2's.
    expect(scoped.map((i) => i.number).sort()).toEqual(['DRG-1', 'MINE.pdf']);
  });
});

describe('searchDocs', () => {
  const items = [
    item({ id: 'a', number: 'DRG-1204', title: 'Embankment typical sections' }),
    item({ id: 'b', number: 'SPEC-R44', title: 'Earthworks specification' }),
    item({ id: 'c', number: 'DRG-1209', title: null }),
  ];

  it('returns a copy of everything for an empty/whitespace query', () => {
    expect(searchDocs(items, '')).toHaveLength(3);
    expect(searchDocs(items, '   ')).toHaveLength(3);
  });

  it('matches on the document number, case-insensitively', () => {
    expect(searchDocs(items, 'spec-r44').map((i) => i.id)).toEqual(['b']);
  });

  it('matches on the title', () => {
    expect(searchDocs(items, 'earthworks').map((i) => i.id)).toEqual(['b']);
  });

  it('tolerates a null title', () => {
    expect(searchDocs(items, 'DRG-1209').map((i) => i.id)).toEqual(['c']);
  });

  it('returns empty when nothing matches', () => {
    expect(searchDocs(items, 'zzz')).toEqual([]);
  });
});

describe('currentDocCount', () => {
  it('counts only the current revisions', () => {
    expect(
      currentDocCount([item({ current: true }), item({ current: false }), item({ current: true })]),
    ).toBe(2);
  });
});

describe('revisionPillLabel', () => {
  it('renders "REV X — CURRENT" for a current revision', () => {
    expect(revisionPillLabel({ revision: 'C', current: true })).toBe('REV C — CURRENT');
  });

  it('renders "REV X — SUPERSEDED" for a superseded revision', () => {
    expect(revisionPillLabel({ revision: 'A', current: false })).toBe('REV A — SUPERSEDED');
  });

  it('drops the REV prefix when the revision is unknown', () => {
    expect(revisionPillLabel({ revision: null, current: true })).toBe('CURRENT');
    expect(revisionPillLabel({ revision: null, current: false })).toBe('SUPERSEDED');
  });
});

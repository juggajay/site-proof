/**
 * Exhaustive unit tests for the pure Drawings & Docs shell state helpers:
 * current-revision detection, the projection + current-first ordering, the
 * optional lot filter, search, counts, and the revision pill label.
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

function item(over: Partial<DocItem> = {}): DocItem {
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

  it('keeps only items linked to the given lot', () => {
    expect(filterDocsByLot(items, 'lot-1').map((i) => i.id)).toEqual(['a']);
  });

  it('yields an empty set for a lot with no linked drawings (honest empty state)', () => {
    expect(filterDocsByLot(items, 'lot-unknown')).toEqual([]);
  });

  it('does not mutate the input', () => {
    const snapshot = items.map((i) => i.id);
    filterDocsByLot(items, 'lot-1');
    expect(items.map((i) => i.id)).toEqual(snapshot);
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

import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Characterizes the failed-ITP-item -> NCR reconstruction used by GET
 * /api/itp/instances/lot/:lotId to re-attach `completion.linkedNcr` after a page reload.
 *
 * The schema has no NCR<->completion relation, so the link is rebuilt from a marker stored
 * in NCR.rectificationNotes. The Prisma query is kept DB-free by mocking the client. These
 * tests freeze:
 *  - the structured marker the create path writes,
 *  - exact full-uuid matching (no substring collisions across items or lots),
 *  - backwards-compatible matching of the legacy `(Item ID: <id>)` form,
 *  - lot-scoped, newest-first selection when an item has multiple NCRs,
 *  - the single batched query (one findMany regardless of completion count),
 *  - the no-op paths (no lot, no failed items).
 */

const mocks = vi.hoisted(() => ({
  ncrFindMany: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    nCR: { findMany: mocks.ncrFindMany },
  },
}));

import { prisma } from '../../../lib/prisma.js';
import {
  buildChecklistItemNcrMarker,
  findLinkedNcrsForChecklistItems,
  rectificationNotesReferencesChecklistItem,
  type NcrLinkClient,
} from './ncrLinks.js';

const client = prisma as unknown as NcrLinkClient;
const LOT_ID = 'lot-1';
const ITEM_A = '11111111-1111-1111-1111-111111111111';
const ITEM_B = '22222222-2222-2222-2222-222222222222';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.ncrFindMany.mockResolvedValue([]);
});

describe('buildChecklistItemNcrMarker', () => {
  it('produces a bracketed, full-uuid marker', () => {
    expect(buildChecklistItemNcrMarker(ITEM_A)).toBe(`[itp-item:${ITEM_A}]`);
  });
});

describe('rectificationNotesReferencesChecklistItem', () => {
  it('matches the structured marker', () => {
    const notes = `Raised from ITP checklist item: Compaction (Item ID: ${ITEM_A}) ${buildChecklistItemNcrMarker(ITEM_A)}`;
    expect(rectificationNotesReferencesChecklistItem(notes, ITEM_A)).toBe(true);
  });

  it('matches the legacy human-readable form for pre-marker NCRs', () => {
    const legacy = `Raised from ITP checklist item: Compaction (Item ID: ${ITEM_A})`;
    expect(rectificationNotesReferencesChecklistItem(legacy, ITEM_A)).toBe(true);
  });

  it('does not match a different item id (no substring false positives)', () => {
    const notes = buildChecklistItemNcrMarker(ITEM_A);
    expect(rectificationNotesReferencesChecklistItem(notes, ITEM_B)).toBe(false);
  });

  it('returns false for empty notes or empty id', () => {
    expect(rectificationNotesReferencesChecklistItem(null, ITEM_A)).toBe(false);
    expect(rectificationNotesReferencesChecklistItem('', ITEM_A)).toBe(false);
    expect(rectificationNotesReferencesChecklistItem(buildChecklistItemNcrMarker(ITEM_A), '')).toBe(
      false,
    );
  });
});

describe('findLinkedNcrsForChecklistItems', () => {
  it('returns the NCR for a failed item with a matching marker', async () => {
    mocks.ncrFindMany.mockResolvedValue([
      {
        id: 'ncr-1',
        ncrNumber: 'NCR-001',
        rectificationNotes: `Raised from ITP checklist item: Compaction (Item ID: ${ITEM_A}) ${buildChecklistItemNcrMarker(ITEM_A)}`,
        raisedAt: new Date('2026-06-01T00:00:00Z'),
      },
    ]);

    const result = await findLinkedNcrsForChecklistItems(client, LOT_ID, [ITEM_A]);

    expect(result.get(ITEM_A)).toEqual({ id: 'ncr-1', ncrNumber: 'NCR-001' });
  });

  it('returns no entry for an item without a matching NCR', async () => {
    mocks.ncrFindMany.mockResolvedValue([
      {
        id: 'ncr-1',
        ncrNumber: 'NCR-001',
        rectificationNotes: buildChecklistItemNcrMarker(ITEM_A),
        raisedAt: new Date('2026-06-01T00:00:00Z'),
      },
    ]);

    const result = await findLinkedNcrsForChecklistItems(client, LOT_ID, [ITEM_B]);

    expect(result.has(ITEM_B)).toBe(false);
  });

  it('scopes the query to the lot and orders newest-first', async () => {
    await findLinkedNcrsForChecklistItems(client, LOT_ID, [ITEM_A]);

    expect(mocks.ncrFindMany).toHaveBeenCalledTimes(1);
    expect(mocks.ncrFindMany).toHaveBeenCalledWith({
      where: { ncrLots: { some: { lotId: LOT_ID } } },
      select: { id: true, ncrNumber: true, rectificationNotes: true, raisedAt: true },
      orderBy: { raisedAt: 'desc' },
    });
  });

  it('returns the newest NCR when an item has more than one', async () => {
    mocks.ncrFindMany.mockResolvedValue([
      {
        id: 'ncr-new',
        ncrNumber: 'NCR-010',
        rectificationNotes: buildChecklistItemNcrMarker(ITEM_A),
        raisedAt: new Date('2026-06-05T00:00:00Z'),
      },
      {
        id: 'ncr-old',
        ncrNumber: 'NCR-002',
        rectificationNotes: buildChecklistItemNcrMarker(ITEM_A),
        raisedAt: new Date('2026-06-01T00:00:00Z'),
      },
    ]);

    const result = await findLinkedNcrsForChecklistItems(client, LOT_ID, [ITEM_A]);

    expect(result.get(ITEM_A)).toEqual({ id: 'ncr-new', ncrNumber: 'NCR-010' });
  });

  it('matches multiple items in a single batched query', async () => {
    mocks.ncrFindMany.mockResolvedValue([
      {
        id: 'ncr-a',
        ncrNumber: 'NCR-001',
        rectificationNotes: buildChecklistItemNcrMarker(ITEM_A),
        raisedAt: new Date('2026-06-02T00:00:00Z'),
      },
      {
        id: 'ncr-b',
        ncrNumber: 'NCR-002',
        rectificationNotes: buildChecklistItemNcrMarker(ITEM_B),
        raisedAt: new Date('2026-06-01T00:00:00Z'),
      },
    ]);

    const result = await findLinkedNcrsForChecklistItems(client, LOT_ID, [ITEM_A, ITEM_B]);

    expect(mocks.ncrFindMany).toHaveBeenCalledTimes(1);
    expect(result.get(ITEM_A)).toEqual({ id: 'ncr-a', ncrNumber: 'NCR-001' });
    expect(result.get(ITEM_B)).toEqual({ id: 'ncr-b', ncrNumber: 'NCR-002' });
  });

  it('does not query when there are no failed items', async () => {
    const result = await findLinkedNcrsForChecklistItems(client, LOT_ID, []);

    expect(mocks.ncrFindMany).not.toHaveBeenCalled();
    expect(result.size).toBe(0);
  });

  it('does not query when the lot id is missing', async () => {
    const result = await findLinkedNcrsForChecklistItems(client, '', [ITEM_A]);

    expect(mocks.ncrFindMany).not.toHaveBeenCalled();
    expect(result.size).toBe(0);
  });
});

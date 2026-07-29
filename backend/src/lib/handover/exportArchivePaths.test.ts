// Wave D `D1c.1` — archive paths, the chainage filename rule and the order key.
// Partial **AT-140** (the format and the sanitize→prefix→collide ordering; the
// manifest half of AT-140 is `D1c.2`'s).
//
// Spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §4.7.3.

import { describe, expect, it } from 'vitest';

import {
  applyChainagePrefix,
  buildArchivePath,
  buildOrderKey,
  EXPORT_CATEGORY_ORDER,
  EXPORT_MEMBER_SOURCE_TYPES,
  resolveArchivePathCollisions,
  roundChainageMetres,
} from './exportArchivePaths.js';
import { sanitizeUploadFilename } from '../../routes/documents/fileHelpers.js';

describe('the chainage filename format, exactly as §4.7.3 pins it', () => {
  const lot = { lotNumber: 'LOT-014', chainageStart: 1250.4, chainageEnd: 1310.0 };

  it('names a span `CH{start}-{end}_{sanitized}`', () => {
    expect(applyChainagePrefix('pipe-bedding-north.jpg', lot, true)).toEqual({
      filename: 'CH1250-1310_pipe-bedding-north.jpg',
      rule: 'chainage_span',
    });
  });

  it('names an equal start and end `CH{n}_{sanitized}`', () => {
    expect(
      applyChainagePrefix('a.jpg', { ...lot, chainageStart: 900.2, chainageEnd: 900.4 }, true)
        .filename,
    ).toBe('CH900_a.jpg');
  });

  it('falls back to the lot number when either chainage is null', () => {
    expect(applyChainagePrefix('a.jpg', { ...lot, chainageEnd: null }, true)).toEqual({
      filename: 'LOT-014_a.jpg',
      rule: 'lot_number',
    });
    expect(applyChainagePrefix('a.jpg', { ...lot, chainageStart: null }, true).rule).toBe(
      'lot_number',
    );
  });

  it('rounds half-UP to whole metres, with no separators and no decimal point', () => {
    expect(roundChainageMetres(1250.4)).toBe(1250);
    expect(roundChainageMetres(1250.5)).toBe(1251);
    // Half-up means "up the number line": `Math.round(-0.5)` is -0, which is
    // half-DOWN in magnitude and would name two different lots identically.
    expect(roundChainageMetres(-0.5)).toBe(0);
    expect(roundChainageMetres(-1.5)).toBe(-1);
    // No thousands separator and no decimal point in the rendered metres:
    // `1250`, not `1,250.00`.
    const rendered = applyChainagePrefix('a.jpg', lot, true).filename;
    expect(rendered).toBe('CH1250-1310_a.jpg');
    expect(rendered).not.toMatch(/1,250|1250\.4|1310\.0/);
  });

  it('puts the low chainage first, so one span always names one prefix', () => {
    const reversed = { lotNumber: 'L1', chainageStart: 1310, chainageEnd: 1250 };
    expect(applyChainagePrefix('a.jpg', reversed, true).filename).toBe('CH1250-1310_a.jpg');
  });

  it('prefixes photos only — a PDF keeps its name, the lot folder carries the lot', () => {
    expect(applyChainagePrefix('report.pdf', lot, false)).toEqual({
      filename: 'report.pdf',
      rule: 'none',
    });
  });
});

describe('sanitize precedes prefix precedes collision-suffix (§4.7.3)', () => {
  it('sanitizes the lot number as a path segment — a traversal never reaches a ZIP entry', () => {
    const path = buildArchivePath('../../etc', 'document', 'a.jpg');
    expect(path).not.toContain('..');
    expect(path.split('/')).toHaveLength(3);
  });

  it('suffixes duplicates ` (2)` BEFORE the extension, in order-key order', () => {
    const resolved = resolveArchivePathCollisions([
      { archivePath: 'L1/documents/site.jpg', orderKey: 'a' },
      { archivePath: 'L1/documents/site.jpg', orderKey: 'b' },
      { archivePath: 'L1/documents/site.jpg', orderKey: 'c' },
    ]);

    expect(resolved.map((m) => m.archivePath)).toEqual([
      'L1/documents/site.jpg',
      'L1/documents/site (2).jpg',
      'L1/documents/site (3).jpg',
    ]);
    // The order the caller supplied is preserved — the suffix follows the
    // order key, it does not reorder members.
    expect(resolved.map((m) => m.orderKey)).toEqual(['a', 'b', 'c']);
  });

  it('does not collide with a source file genuinely named `x (2).jpg`', () => {
    const resolved = resolveArchivePathCollisions([
      { archivePath: 'L1/documents/x.jpg' },
      { archivePath: 'L1/documents/x (2).jpg' },
      { archivePath: 'L1/documents/x.jpg' },
    ]);
    expect(new Set(resolved.map((m) => m.archivePath)).size).toBe(3);
    expect(resolved[2]!.archivePath).toBe('L1/documents/x (3).jpg');
  });

  it('suffixes an extensionless name at the end', () => {
    const resolved = resolveArchivePathCollisions([
      { archivePath: 'L1/documents/README' },
      { archivePath: 'L1/documents/README' },
    ]);
    expect(resolved[1]!.archivePath).toBe('L1/documents/README (2)');
  });

  it('collides only AFTER prefixing — the ordering rule, asserted', () => {
    // Two DIFFERENT source names that sanitize and prefix onto the same path.
    // Resolving collisions before prefixing would have seen no collision at all
    // and produced two identical archive entries.
    const lot = { lotNumber: 'L1', chainageStart: 100, chainageEnd: 100 };
    const first = applyChainagePrefix(sanitizeUploadFilename('a<b.jpg'), lot, true).filename;
    const second = applyChainagePrefix(sanitizeUploadFilename('a>b.jpg'), lot, true).filename;
    expect(first).toBe(second);

    const resolved = resolveArchivePathCollisions([
      { archivePath: buildArchivePath('L1', 'document', first) },
      { archivePath: buildArchivePath('L1', 'document', second) },
    ]);
    expect(resolved[0]!.archivePath).not.toBe(resolved[1]!.archivePath);
  });
});

describe('the order key is deterministic and total (§4.7.3)', () => {
  it('sorts by lot, then declared category order, then uploadedAt, then id', () => {
    const keys = [
      buildOrderKey({
        lotIndex: 1,
        lotNumber: 'L2',
        sourceType: 'folio',
        uploadedAt: new Date('2026-01-01'),
        sourceId: 'a',
      }),
      buildOrderKey({
        lotIndex: 0,
        lotNumber: 'L1',
        sourceType: 'document',
        uploadedAt: new Date('2026-01-01'),
        sourceId: 'b',
      }),
      buildOrderKey({
        lotIndex: 0,
        lotNumber: 'L1',
        sourceType: 'folio',
        uploadedAt: new Date('2026-02-01'),
        sourceId: 'c',
      }),
      buildOrderKey({
        lotIndex: 0,
        lotNumber: 'L1',
        sourceType: 'folio',
        uploadedAt: new Date('2026-01-01'),
        sourceId: 'd',
      }),
    ];

    const sorted = [...keys].sort();
    expect(sorted).toEqual([keys[3], keys[2], keys[1], keys[0]]);
  });

  it('sorts lot 10 after lot 9 — a raw lot number would not', () => {
    const nine = buildOrderKey({
      lotIndex: 8,
      lotNumber: 'L9',
      sourceType: 'folio',
      uploadedAt: null,
      sourceId: 'a',
    });
    const ten = buildOrderKey({
      lotIndex: 9,
      lotNumber: 'L10',
      sourceType: 'folio',
      uploadedAt: null,
      sourceId: 'b',
    });
    expect([ten, nine].sort()).toEqual([nine, ten]);
    // The naive key would have put L10 first.
    expect(['L10', 'L9'].sort()).toEqual(['L10', 'L9']);
  });

  it('places a null timestamp first, deterministically', () => {
    const nullish = buildOrderKey({
      lotIndex: 0,
      lotNumber: 'L1',
      sourceType: 'folio',
      uploadedAt: null,
      sourceId: 'a',
    });
    const dated = buildOrderKey({
      lotIndex: 0,
      lotNumber: 'L1',
      sourceType: 'folio',
      uploadedAt: new Date(0),
      sourceId: 'a',
    });
    expect([dated, nullish].sort()[0]).toBe(nullish);
  });
});

describe('the category table cannot drift from the source-type vocabulary', () => {
  it('declares an order position for every §7.5 source type', () => {
    expect([...EXPORT_CATEGORY_ORDER].sort()).toEqual([...EXPORT_MEMBER_SOURCE_TYPES].sort());
  });
});

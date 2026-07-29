// Wave D `D1c.2` — deriving §4.7.3's filename rule from the FROZEN path.
//
// **AT-140**: "the manifest records the rule applied, per member." The rule is
// read back off the frozen archive path rather than recomputed from the lot's
// current chainage, because the manifest describes the archive it ships with —
// and a lot edited after the freeze must not make the manifest disagree with
// the names in the ZIP.

import { describe, expect, it } from 'vitest';

import { deriveFilenameRule } from './exportMemberSources.js';

const LOT = { lotNumber: 'LOT-001', chainageStart: 1250.4, chainageEnd: 1310 };

describe('deriveFilenameRule', () => {
  it('reads back all three rules from the path the freeze produced', () => {
    expect(deriveFilenameRule('LOT-001/documents/CH1250-1310_a.jpg', LOT, true)).toBe(
      'chainage_span',
    );
    expect(
      deriveFilenameRule(
        'LOT-001/documents/CH981_a.jpg',
        {
          ...LOT,
          chainageStart: 980.5,
          chainageEnd: 980.5,
        },
        true,
      ),
    ).toBe('chainage_point');
    expect(
      deriveFilenameRule(
        'LOT-001/documents/LOT-001_a.jpg',
        {
          ...LOT,
          chainageStart: null,
          chainageEnd: null,
        },
        true,
      ),
    ).toBe('lot_number');
  });

  it('is `none` for a non-photo, which is never prefixed', () => {
    expect(deriveFilenameRule('LOT-001/documents/lab report.pdf', LOT, false)).toBe('none');
  });

  it('is `none` when the frozen name carries no prefix at all', () => {
    // The lot has a chainage now, but this member was frozen without one — the
    // path is the record, not the current row.
    expect(deriveFilenameRule('LOT-001/documents/a.jpg', LOT, true)).toBe('none');
  });

  it('survives the collision suffix, which lands before the extension', () => {
    expect(deriveFilenameRule('LOT-001/documents/CH1250-1310_a (2).jpg', LOT, true)).toBe(
      'chainage_span',
    );
  });
});

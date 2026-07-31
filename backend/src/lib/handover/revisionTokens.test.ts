// Wave D `D1b` — §7.7 revision tokens. Part of **AT-146**.

import { describe, expect, it } from 'vitest';

import {
  FOLIO_PAYLOAD_SCHEMA_VERSION,
  HOLD_POINT_DIGEST_FIELDS,
  ITP_COMPLETION_DIGEST_FIELDS,
  REVISION_TOKEN_KINDS,
  canonicalRowDigest,
  pickDigestFields,
  revisionToken,
  sourceRowRef,
  type FolioSourceType,
} from './revisionTokens.js';

const ALL_SOURCE_TYPES: readonly FolioSourceType[] = [
  'document',
  'folio_issue',
  'ncr',
  'test_result',
  'itp_completion',
  'hold_point',
  // Wave `C5.3`.
  'survey_record',
  'diary_delivery',
];

describe('revision tokens (§7.7)', () => {
  it('declares a token kind for every source type, exhaustively', () => {
    // `[DR2-B3]`: the defect was a contract that assumed every model has a
    // version. Adding a source type without a kind is a compile error; this
    // asserts the runtime table has not been left half-filled either.
    expect(Object.keys(REVISION_TOKEN_KINDS).sort()).toEqual([...ALL_SOURCE_TYPES].sort());
    for (const sourceType of ALL_SOURCE_TYPES) {
      expect(REVISION_TOKEN_KINDS[sourceType]).toBeTruthy();
    }
  });

  it('assigns the kinds §7.7 names, per model', () => {
    expect(REVISION_TOKEN_KINDS.document).toBe('version');
    expect(REVISION_TOKEN_KINDS.folio_issue).toBe('version');
    expect(REVISION_TOKEN_KINDS.ncr).toBe('updated_at');
    expect(REVISION_TOKEN_KINDS.test_result).toBe('updated_at');
    // The two that have NEITHER a version nor an `updatedAt` — the finding
    // that produced this module.
    expect(REVISION_TOKEN_KINDS.itp_completion).toBe('row_digest');
    expect(REVISION_TOKEN_KINDS.hold_point).toBe('row_digest');
    // Wave `C5.3`: both tables carry `updatedAt` and neither carries a version,
    // so neither needs the digest machinery.
    expect(REVISION_TOKEN_KINDS.survey_record).toBe('updated_at');
    expect(REVISION_TOKEN_KINDS.diary_delivery).toBe('updated_at');
  });

  it('prefixes every token with its kind', () => {
    expect(revisionToken('document', { kind: 'version', version: 3 })).toBe('v:3');
    expect(
      revisionToken('ncr', { kind: 'updated_at', updatedAt: new Date('2026-07-28T01:02:03.000Z') }),
    ).toBe('t:2026-07-28T01:02:03.000Z');
    expect(
      revisionToken('hold_point', { kind: 'row_digest', fields: { status: 'released' } }),
    ).toMatch(/^d:[0-9a-f]{64}$/);
  });

  it('refuses a cheaper token than the source type declares', () => {
    // A caller cannot downgrade `ITPCompletion` to a timestamp it does not have.
    expect(() =>
      revisionToken('itp_completion', { kind: 'updated_at', updatedAt: new Date() }),
    ).toThrow(/expected row_digest/);
  });

  it('digests are stable under key order and change with any listed field', () => {
    const a = canonicalRowDigest({ status: 'complete', notes: 'x', attachmentIds: ['1', '2'] });
    const b = canonicalRowDigest({ attachmentIds: ['1', '2'], notes: 'x', status: 'complete' });
    expect(a).toBe(b);

    const changed = canonicalRowDigest({
      status: 'complete',
      notes: 'y',
      attachmentIds: ['1', '2'],
    });
    expect(changed).not.toBe(a);

    // The attachment SET is part of the identity: adding evidence to a
    // completion is a different piece of evidence.
    const moreAttachments = canonicalRowDigest({
      status: 'complete',
      notes: 'x',
      attachmentIds: ['1', '2', '3'],
    });
    expect(moreAttachments).not.toBe(a);
  });

  it('picks exactly the declared field list, with a null for anything absent', () => {
    const picked = pickDigestFields(
      { status: 'released', stray: 'ignored' },
      HOLD_POINT_DIGEST_FIELDS,
    );
    expect(Object.keys(picked)).toEqual([...HOLD_POINT_DIGEST_FIELDS]);
    expect(picked).not.toHaveProperty('stray');
    expect(picked.releasedAt).toBeNull();
  });

  it('pins both digest field lists against a silent change', () => {
    // §7.7: "a digest whose input set changes silently is worse than no digest".
    // Changing either list without bumping the payload schema version is what
    // this catches.
    expect([...ITP_COMPLETION_DIGEST_FIELDS]).toEqual([
      'status',
      'completedAt',
      'verificationStatus',
      'verifiedAt',
      'notes',
      'signatureUrl',
      'attachmentIds',
    ]);
    expect([...HOLD_POINT_DIGEST_FIELDS]).toEqual([
      'status',
      'releasedAt',
      'releasedByName',
      'releasedByOrg',
      'releaseMethod',
      'releaseSignatureUrl',
      'evidencePackageUrl',
    ]);
    // Wave `C5.3` bumped this 1 -> 2 for a payload SHAPE change (two new
    // evidence collections), not a digest-list change — the digest lists above
    // are unchanged, which is why they still read exactly as they did.
    expect(FOLIO_PAYLOAD_SCHEMA_VERSION).toBe(2);
  });

  it('builds a source ref carrying type, id and token', () => {
    expect(
      sourceRowRef('test_result', 'tr-1', {
        kind: 'updated_at',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toEqual({
      sourceType: 'test_result',
      sourceId: 'tr-1',
      revision: 't:2026-01-01T00:00:00.000Z',
    });
  });
});

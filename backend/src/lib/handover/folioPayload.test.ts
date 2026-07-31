// Wave `C5.3` — the folio payload contract after two collections were added.
// **AT-179** (the ceiling counts them) · **AT-180** (the schema-version bump is
// honest: a stored v1 snapshot is refused, never read as v2).

import { describe, expect, it } from 'vitest';

import { buildFolioPayloadFixture } from './folioFixture.js';
import {
  countEvidenceRows,
  isFolioPayloadSchemaCurrent,
  type FolioEvidencePayload,
} from './folioPayload.js';
import { FOLIO_PAYLOAD_SCHEMA_VERSION } from './revisionTokens.js';

const EMPTY: FolioEvidencePayload = {
  tests: [],
  ncrs: [],
  documents: [],
  itpCompletions: [],
  holdPoints: [],
  surveys: [],
  deliveries: [],
};

describe('countEvidenceRows — the ceiling counts every collection (**AT-179**)', () => {
  it('counts surveys and deliveries alongside the five shipped collections', () => {
    expect(countEvidenceRows(EMPTY)).toBe(0);

    // Every collection is worth exactly one row each, so a lot cannot slip past
    // `FOLIO_EVIDENCE_ROW_CEILING_DEFAULT` by putting its bulk in a collection
    // the counter forgot. The ceiling drives a REFUSAL upstream
    // (`routes/folio/assemble.ts`), so an uncounted collection is a folio that
    // silently exceeds its own stated bound.
    const one = { id: 'x' } as never;
    for (const key of Object.keys(EMPTY) as Array<keyof FolioEvidencePayload>) {
      expect(countEvidenceRows({ ...EMPTY, [key]: [one] })).toBe(1);
    }
    expect(Object.keys(EMPTY)).toHaveLength(7);
  });

  it('is what the fixture reports as its own row count', () => {
    const payload = buildFolioPayloadFixture();
    expect(payload.evidenceRowCount).toBe(countEvidenceRows(payload.evidence));
  });
});

describe('the schema-version bump is honest (**AT-180**)', () => {
  it('is at 2 — the version this build both writes and reads', () => {
    expect(FOLIO_PAYLOAD_SCHEMA_VERSION).toBe(2);
    expect(buildFolioPayloadFixture().schemaVersion).toBe(2);
  });

  it('accepts a payload written at the current version', () => {
    expect(isFolioPayloadSchemaCurrent(buildFolioPayloadFixture())).toBe(true);
  });

  it('REFUSES a stored v1 snapshot rather than reading it as v2', () => {
    // The real shape of the hazard: a `FolioSnapshot` row written by the
    // previous deploy, still inside its one-hour TTL, issued after this one
    // ships. It has no `evidence.surveys` and no `evidence.deliveries`, so
    // rendering it would either throw on `.length` or — worse, if the renderer
    // were ever made lenient — produce a folio that looks like the lot holds no
    // survey and no delivery. `[DH-B1]` forbids the second outcome outright.
    const v1 = buildFolioPayloadFixture();
    const stored = { ...v1, schemaVersion: 1 };
    expect(isFolioPayloadSchemaCurrent(stored)).toBe(false);

    // And it is a VERSION check, not a shape check: a v1 payload that happens
    // to carry the new keys is still refused, because the version is the only
    // thing the writer promised.
    expect(isFolioPayloadSchemaCurrent({ ...v1, schemaVersion: 1, evidence: EMPTY })).toBe(false);
  });

  it('refuses anything that is not a payload at all, without throwing', () => {
    for (const value of [null, undefined, 'v2', 2, [], {}, { schemaVersion: '2' }]) {
      expect(isFolioPayloadSchemaCurrent(value)).toBe(false);
    }
  });
});

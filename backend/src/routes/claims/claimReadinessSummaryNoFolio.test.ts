// AT-F1-NOFOLIO (Wave F spec §1.4).
//
// The §0.3 boundary the whole wave hangs on: a CIVOS-derived dollar figure may
// appear on a SCREEN with the §1.4 label, and may never appear on an evidence
// document — folio, evidence package, or exported PDF. Nothing enforces that
// structurally, so it is enforced here the way the spec sanctions: a source
// scan over every evidence-document builder, failing if any of them reaches for
// the F1 aggregate.
//
// The mechanism is deliberately crude. It cannot prove the number is absent
// from a rendered PDF; it proves that no evidence-document builder has a PATH
// to the aggregate, which is the property a reviewer can actually check.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const backendSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Every builder that produces an evidence document rather than a screen. */
const EVIDENCE_DOCUMENT_BUILDERS = [
  'lib/handover/folioPayload.ts',
  'lib/handover/folioRenderer.ts',
  'lib/handover/folioFixture.ts',
  'lib/handover/exportAssembly.ts',
  'lib/handover/exportManifest.ts',
  'lib/handover/exportMemberSources.ts',
  'lib/handover/exportRunner.ts',
  'routes/claims/evidenceRoutes.ts',
  'routes/claims/xeroExport.ts',
];

/** Anything that would pull an F1 figure into one of those files. */
const FORBIDDEN = [
  'claimReadinessSummary',
  'claim-readiness/summary',
  'claim-readiness/blocked-lots',
  'blockedValue',
  'claimableValue',
];

describe('AT-F1-NOFOLIO', () => {
  it.each(EVIDENCE_DOCUMENT_BUILDERS)('%s does not reach for the F1 aggregate', (relativePath) => {
    const source = readFileSync(path.join(backendSrc, relativePath), 'utf8');
    for (const needle of FORBIDDEN) {
      expect(source).not.toContain(needle);
    }
  });

  it('names builders that exist, so a rename cannot silently empty this guard', () => {
    for (const relativePath of EVIDENCE_DOCUMENT_BUILDERS) {
      expect(() => readFileSync(path.join(backendSrc, relativePath), 'utf8')).not.toThrow();
    }
  });
});

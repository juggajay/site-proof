import { describe, expect, it } from 'vitest';

import { documentationSections } from './documentationContent';

// ---------------------------------------------------------------------------
// PINNED MIRROR — this list must equal HELP_TOPICS in the backend's Clancy
// product knowledge (backend/src/routes/copilot/chat/productKnowledge.ts,
// pinned there in productKnowledge.test.ts). The backend copilot cannot import
// this frontend module, so these two pins are the drift guard: add, remove, or
// rename a documentation section and BOTH tests fail until the backend mirror
// and this list are updated together, on purpose.
// ---------------------------------------------------------------------------
const PINNED_SECTIONS: ReadonlyArray<[id: string, title: string]> = [
  ['projects-lots', 'Projects and lots'],
  ['site-map', 'Site map and lot geometry'],
  ['readiness', 'Evidence Readiness'],
  ['itp-holdpoints-tests', 'ITPs, hold points, and test results'],
  ['subbie-dockets', 'Subcontractor portal and dockets'],
  ['documents-drawings', 'Documents, drawings, and photos'],
  ['ncr-diary', 'NCRs and daily diary'],
  ['claims-reports', 'Claims, variations, costs, and reports'],
  ['admin', 'Admin, audit, and settings'],
];

describe('documentationSections — pinned mirror for Clancy product knowledge', () => {
  it('has the exact sections in the order the backend mirror pins', () => {
    expect(documentationSections.map((s) => [s.id, s.title])).toEqual(PINNED_SECTIONS);
  });
});

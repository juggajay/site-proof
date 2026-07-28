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
  ['ai-copilot', 'AI in CIVOS: setup copilot and Clancy'],
  ['integrations', 'Integrations: API keys and webhooks'],
];

describe('documentationSections — pinned mirror for Clancy product knowledge', () => {
  it('has the exact sections in the order the backend mirror pins', () => {
    expect(documentationSections.map((s) => [s.id, s.title])).toEqual(PINNED_SECTIONS);
  });
});

// ---------------------------------------------------------------------------
// Wave C1 test-sufficiency copy. These sentences are claims about the shipped
// engine (backend/src/lib/readiness/sufficiency/), written first in the backend
// mirror and pinned there against the code in productKnowledge.test.ts. This is
// the frontend half of that pin: soften a number or a rule here and it fails, so
// the docs page cannot quietly drift away from what Clancy tells a QM.
// ---------------------------------------------------------------------------
const PINNED_SUFFICIENCY_COPY: ReadonlyArray<[sectionId: string, sentence: string]> = [
  ['readiness', 'VicRoads Section 204 for Victorian earthworks, TfNSW Q6 for NSW earthworks'],
  ['readiness', '6 compaction tests on Compaction Scale A or B and 3 on Scale C'],
  ['readiness', 'Scale A applies where the specification does not state one'],
  ['readiness', 'Specified relative compaction'],
  ['readiness', 'advisory on every project today'],
  ['readiness', '"Test frequency cannot be checked"'],
  [
    'readiness',
    'Set the lot activity, testing scale, and quantity, or draw the lot geometry, on the lot edit page',
  ],
  [
    'readiness',
    'After three consecutive conforming lots a VicRoads lot can become eligible to request a reduced frequency',
  ],
  ['readiness', 'never reduces the count itself'],
  ['itp-holdpoints-tests', 'Density Ratio, AS 1289.5.4.1, and RC 316.00 all count as compaction'],
  ['itp-holdpoints-tests', 'never count toward the field test number'],
  ['itp-holdpoints-tests', 'means the test type is not recognised, not that the test is unlinked'],
  ['admin', 'off, warn, or block, and is set per project'],
  // Wave C3 exit item 12 — the map's Testing overlay and the sample point.
  // Written first in the backend mirror and pinned there against the shipped
  // code (routes/projectTestCoverage.ts, testCoverageData.ts, lib/samplePoint.ts).
  ['site-map', 'Use Testing to recolour drawn lots by test frequency'],
  ['site-map', 'Test pins to show where samples were taken'],
  ['site-map', 'green for Testing satisfied'],
  ['site-map', 'amber for Fewer tests than required'],
  ['site-map', 'grey for No rule'],
  ['site-map', 'Lots that are not drawn are counted, not coloured'],
  ['site-map', 'internal layer that subcontractors never see'],
  ['site-map', 'unavailable in History'],
  ['site-map', 'shows a pin only where someone captured a sample point'],
  ['site-map', 'counted toward the frequency but never drawn'],
  ['itp-holdpoints-tests', 'optional and blocks nothing'],
  ['itp-holdpoints-tests', 'a GPS fix coarser than 30 m is refused'],
  ['itp-holdpoints-tests', 'a map pick carries no accuracy figure'],
  ['itp-holdpoints-tests', 'CIVOS never derives a sample location'],
];

describe('documentationSections — test sufficiency facts', () => {
  const sectionText = (id: string) => {
    const section = documentationSections.find((s) => s.id === id);
    if (!section) throw new Error(`no documentation section "${id}"`);
    return [
      section.summary,
      ...section.steps.map((s) => `${s.title}. ${s.description}`),
      ...section.tips,
    ].join('\n');
  };

  it.each(PINNED_SUFFICIENCY_COPY)('%s states: %s', (id, sentence) => {
    expect(sectionText(id)).toContain(sentence);
  });
});

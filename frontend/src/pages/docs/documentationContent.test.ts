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
  ['getting-started', 'Getting started: your first project'],
  ['projects-lots', 'Projects and lots'],
  ['site-map', 'Site map and lot geometry'],
  ['readiness', 'Evidence Readiness'],
  ['itp-holdpoints-tests', 'ITPs, hold points, and test results'],
  ['subbie-dockets', 'Subcontractor portal and dockets'],
  ['documents-drawings', 'Documents, drawings, and photos'],
  ['ncr-diary', 'NCRs and daily diary'],
  ['deliveries', 'Deliveries and materials'],
  ['claims-reports', 'Claims, variations, costs, and reports'],
  ['handover', 'Handover and the evidence folio'],
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
  // Wave C2 Phase 3 (J5) — the lab-wait honesty caveat. Pinned in the backend
  // mirror since C2 and, until now, on that side ONLY: this page could have
  // dropped "CIVOS never assumes a turnaround" and no test would have failed,
  // even though the header above advertises the pair as guarded. `getLabWait`
  // (backend sufficiency `constants.ts`) marks a row overdue only from a
  // USER-supplied expectedResultDate, so a blank date reading as late here
  // would be a fabricated turnaround.
  ['itp-holdpoints-tests', 'Send to lab records that a sample went to a laboratory'],
  ['itp-holdpoints-tests', 'CIVOS never assumes a turnaround'],
  ['itp-holdpoints-tests', 'a blank date shows elapsed days only and is never flagged late'],
  ['admin', 'off, warn, or block, and is set per project'],
  // Wave C3 exit item 12 — the map's Testing overlay and the sample point.
  // Written first in the backend mirror and pinned there against the shipped
  // code (routes/projectTestCoverage.ts, testCoverageData.ts, lib/samplePoint.ts).
  ['site-map', 'Testing to recolour drawn lots by test frequency'],
  ['site-map', 'Test pins to show where samples were taken'],
  ['site-map', 'green for Testing satisfied'],
  ['site-map', 'amber for Fewer tests than required'],
  ['site-map', 'grey for No rule'],
  ['site-map', 'Lots that are not drawn are counted, not coloured'],
  ['site-map', 'internal layer that subcontractors never see'],
  ['site-map', 'unavailable in Past view'],
  ['site-map', 'shows a pin only where someone captured a sample point'],
  ['site-map', 'counted toward the frequency but never drawn'],
  ['itp-holdpoints-tests', 'optional and blocks nothing'],
  ['itp-holdpoints-tests', 'a GPS fix coarser than 30 m is refused'],
  ['itp-holdpoints-tests', 'a map pick carries no accuracy figure'],
  ['itp-holdpoints-tests', 'CIVOS never derives a sample location'],
  // Wave E exit item 13 — the automatic chase. Same discipline: written first in
  // the backend mirror and pinned there against the shipped code. The canary
  // sentence is the one that must never be softened — the automation is inert
  // until a project is named, so copy promising it unconditionally is false on
  // every project today.
  ['itp-holdpoints-tests', 'sits at Notified until it is released'],
  ['itp-holdpoints-tests', 'only on projects that have been switched on for it by name'],
  ['itp-holdpoints-tests', 'one working day before the scheduled release date'],
  ['itp-holdpoints-tests', 'every two working days while it stays overdue'],
  ['itp-holdpoints-tests', 'up to three reminders per release request'],
  ['itp-holdpoints-tests', 'one email per recipient per project per day'],
  ['itp-holdpoints-tests', 'each with its own live release link'],
  ['itp-holdpoints-tests', 'It does not show them the other addresses the request went to'],
  ['itp-holdpoints-tests', 'never shows the email address of the person who requested release'],
  ['itp-holdpoints-tests', 'There is no CIVOS inbox or queue for them to sign into'],
  // The rest of the Wave E chase copy, backend-pinned since E but never mirrored
  // here. Each is a claim about shipped behaviour that a QM acts on, so a
  // one-sided pin is not a pin: the canary's other half (nothing is sent
  // elsewhere), the per-request reset, the daily-limit consequence, the four
  // terminators, the requester-attribution fallbacks, and the alert severities.
  ['itp-holdpoints-tests', 'nothing is sent automatically and you chase manually as before'],
  ['itp-holdpoints-tests', 'Requesting release again starts a fresh request with a fresh three'],
  ['itp-holdpoints-tests', 'They never get a second message that day'],
  [
    'itp-holdpoints-tests',
    'Releasing the hold point, re-requesting it, closing the project, or removing that address from the notification list all stop the reminders',
  ],
  ['itp-holdpoints-tests', 'name that person or say Site Team'],
  [
    'itp-holdpoints-tests',
    'Replies to a hold point email reach the person who requested the release',
  ],
  ['itp-holdpoints-tests', 'company support, and the email says so'],
  [
    'itp-holdpoints-tests',
    'raises an internal Hold Point stale alert to the project team, at high severity and critical once it is two days past',
  ],
  // The second half of the anti-fabrication line, which NEITHER side pinned:
  // "no inbox" was guarded, "no cross-project list" was not. E3 was specified,
  // costed and deferred (`[E-g]`) — no HoldPointReviewQueue model exists — and
  // a cross-project outstanding list is the exact thing Clancy would invent.
  ['itp-holdpoints-tests', 'no list of everything they owe you across projects'],
  // Deliveries and handover — written first in the backend mirror and pinned
  // there against the shipped code (routes/deliveries, evidenceReadiness/
  // deliveryItems.ts, routes/folio, routes/handoverExports). This is the
  // frontend half. The two that must never soften: a typed docket number is not
  // filed evidence, and the folio LISTS documents and photos rather than
  // embedding them.
  [
    'deliveries',
    'means the actual supplier docket document is attached. A typed docket number alone does not count',
  ],
  ['deliveries', 'project-wide totals that filters never shrink'],
  ['deliveries', 'only those three evidence fields, and every change is written to the audit log'],
  ['deliveries', 'raises a support-level readiness prompt. It never blocks conformance or a claim'],
  ['deliveries', 'The link is set at creation only'],
  ['deliveries', 'sorts by the diary date the delivery was recorded against'],
  ['deliveries', 'Deliveries are internal. Subcontractors never see'],
  ['handover', 'a listing of the documents and photos held'],
  ['handover', 'SHA-256 hash shown in the app'],
  ['handover', 'Version numbers are never reused and old versions are never'],
  ['handover', 'above 5,000 evidence rows it refuses to issue rather than silently omit records'],
  ['handover', 'nudges when lots lack an evidence folio, but it never'],
  [
    'handover',
    'Requesting an export and issuing folios is owner, admin, project manager, and quality manager',
  ],
  [
    'handover',
    'Downloading a handover export is owner, admin, and project manager — plus the person who requested that export',
  ],
  [
    'handover',
    'expires on its stated date and can no longer be downloaded after that — unless a legal hold has been placed on it, which keeps it downloadable',
  ],
  // The getting-started walkthrough. Written first in the backend mirror and
  // pinned there against the shipped code. Every sentence below is one the
  // fact-check CHANGED from the drafted copy — pinned precisely because the
  // plausible-sounding version is the wrong one (invite lives in company
  // settings, the plan-sheet fit uses control points, the map control is
  // labelled Past view).
  [
    'getting-started',
    'Someone who has never used CIVOS is invited to the company first, under Company Settings, Team Members',
  ],
  [
    'getting-started',
    'any other PDF is placed by matching control points to their grid coordinates',
  ],
  ['getting-started', "the map's Past view replays the job"],
  ['getting-started', 'generate an evidence package to send with each one'],
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

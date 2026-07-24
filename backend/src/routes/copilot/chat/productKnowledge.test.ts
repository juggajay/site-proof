import { describe, expect, it } from 'vitest';

import { HELP_TOPICS, HELP_TOPIC_SLUGS, getHelpTopic } from './productKnowledge.js';

// ---------------------------------------------------------------------------
// PINNED MIRROR — this list must equal documentationSections in
// frontend/src/pages/docs/documentationContent.ts, pinned there in
// documentationContent.test.ts. Backend vitest cannot import the frontend
// module, so the two pins are the drift guard: change the docs sections and
// both this test and the frontend one fail until updated together. Keep the
// slug (= section id) and title in the same order as the frontend sections.
// ---------------------------------------------------------------------------
const PINNED_TOPICS: ReadonlyArray<[slug: string, title: string]> = [
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

describe('product knowledge — pinned mirror of the docs sections', () => {
  it('has the exact topics in the same order as documentationSections', () => {
    expect(HELP_TOPICS.map((t) => [t.slug, t.title])).toEqual(PINNED_TOPICS);
  });

  it('exposes the slugs for the get_help enum', () => {
    expect(HELP_TOPIC_SLUGS).toEqual(PINNED_TOPICS.map(([slug]) => slug));
  });

  it('has unique slugs and a non-empty body per topic', () => {
    expect(new Set(HELP_TOPIC_SLUGS).size).toBe(HELP_TOPIC_SLUGS.length);
    for (const topic of HELP_TOPICS) {
      expect(topic.body.trim().length).toBeGreaterThan(0);
    }
  });

  it('resolves a known slug and returns undefined for an unknown one', () => {
    expect(getHelpTopic('readiness')?.title).toBe('Evidence Readiness');
    expect(getHelpTopic('nope')).toBeUndefined();
  });
});

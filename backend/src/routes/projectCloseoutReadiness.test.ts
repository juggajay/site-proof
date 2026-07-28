// Wave D `D1a` — the pure half of quality closeout readiness (spec Rev 3 §14).
//
// AT-121 (unit): absence is NAMED `[DH-B1]`. Plus the two properties that make
// the DB-backed AT-119/AT-120 assertions mean something: the fold invents no
// code, and it stores nothing it could serve stale.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { HANDOVER_BLOCKING_REASON_CODES } from '../lib/readiness/contracts/reasonCodes.js';
import type { LotCloseoutReadinessSnapshot } from '../lib/readiness/contracts/futureConsumers.js';
import { closeoutVerdict, projectCloseoutVerdict } from './projectCloseoutReadiness.js';

function snapshot(overrides: Partial<LotCloseoutReadinessSnapshot> = {}) {
  const base: LotCloseoutReadinessSnapshot = {
    lotId: 'lot-1',
    lotNumber: 'LOT-001',
    status: 'in_progress',
    chainageStart: null,
    chainageEnd: null,
    activitySlug: null,
    claimedInId: null,
    conformanceOverriddenAt: null,
    prerequisites: {
      itpAssigned: false,
      itpCompleted: false,
      itpCompletedCount: 0,
      itpTotalCount: 0,
      itpIncompleteItems: [],
      testRequired: false,
      hasPassingTest: false,
      testResults: [],
      noOpenNcrs: true,
      openNcrs: [],
    },
    openMajorNcrCount: 0,
    unreleasedHoldPoints: 0,
    sufficiency: null,
  };
  return { ...base, ...overrides };
}

describe('AT-121 — absence is named, never an empty array [DH-B1]', () => {
  it('a lot with no ITP returns `no_itp_assigned`', () => {
    const verdict = closeoutVerdict(snapshot());

    expect(verdict.ready).toBe(false);
    expect(verdict.reasonCodes).toContain('no_itp_assigned');
    // Not an empty array, and not a generic "incomplete": the code names the
    // thing that is missing.
    expect(verdict.reasonCodes.length).toBeGreaterThan(0);
    expect(verdict.subjectType).toBe('lot');
    expect(verdict.subjectId).toBe('lot-1');
  });

  it('a lot with everything in place is ready with an empty code list', () => {
    const verdict = closeoutVerdict(
      snapshot({
        status: 'conformed',
        prerequisites: {
          ...snapshot().prerequisites,
          itpAssigned: true,
          itpCompleted: true,
          itpCompletedCount: 1,
          itpTotalCount: 1,
        },
      }),
    );

    expect(verdict.ready).toBe(true);
    expect(verdict.reasonCodes).toEqual([]);
  });
});

describe('the fold emits registry codes only, in registry order', () => {
  it('every emitted code is a registered handover code', () => {
    const verdict = closeoutVerdict(
      snapshot({
        openMajorNcrCount: 2,
        unreleasedHoldPoints: 4,
        prerequisites: {
          ...snapshot().prerequisites,
          itpAssigned: true,
          itpCompleted: false,
          itpIncompleteItems: [{ id: 'ci-1', description: 'Compaction', pointType: 'test' }],
          testRequired: true,
          hasPassingTest: false,
          noOpenNcrs: false,
          openNcrs: [{ id: 'n1', ncrNumber: 'NCR-1', description: 'x', status: 'open' }],
          noNaHoldPointBypass: false,
          naHoldPointBlockerCount: 1,
          sufficiencyBlocks: true,
        },
      }),
    );

    for (const code of verdict.reasonCodes) {
      expect(HANDOVER_BLOCKING_REASON_CODES).toContain(code);
    }
    // Registry order, so two reads of unchanged data are byte-identical.
    const ranks = verdict.reasonCodes.map((c) => HANDOVER_BLOCKING_REASON_CODES.indexOf(c));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    // The commercial hard blockers stay out — D1a is the QUALITY scope.
    expect(verdict.reasonCodes).not.toContain('missing_budget');
    expect(verdict.reasonCodes).not.toContain('already_claimed');
  });

  it('`open_major_ncrs` rides the counted input, not a second NCR rule', () => {
    const withMajor = closeoutVerdict(snapshot({ openMajorNcrCount: 1 }));
    const withoutMajor = closeoutVerdict(snapshot({ openMajorNcrCount: 0 }));

    expect(withMajor.reasonCodes).toContain('open_major_ncrs');
    expect(withoutMajor.reasonCodes).not.toContain('open_major_ncrs');
  });

  it('a force-conformed lot reads as the lot page reads it, not as blocked', () => {
    // Without `conformanceOverriddenAt` on the snapshot the fold re-derives the
    // suppressed prerequisites and calls this lot blocked, while the lot page
    // calls it conformed. That divergence is why the field is carried.
    const incompleteItp = {
      ...snapshot().prerequisites,
      itpAssigned: true,
      itpCompleted: false,
      itpCompletedCount: 1,
      itpTotalCount: 2,
      itpIncompleteItems: [{ id: 'ci-1', description: 'Trim', pointType: 'standard' }],
    };

    expect(
      closeoutVerdict(
        snapshot({
          status: 'conformed',
          conformanceOverriddenAt: '2026-01-15T00:00:00.000Z',
          prerequisites: incompleteItp,
        }),
      ).reasonCodes,
    ).toEqual([]);

    expect(
      closeoutVerdict(snapshot({ status: 'conformed', prerequisites: incompleteItp })).reasonCodes,
    ).toContain('itp_incomplete');
  });
});

describe('the frontend mirror cannot drift from the registry [DH-B5]', () => {
  it('the closeout section mirrors exactly the registered codes, in order', () => {
    // The frontend cannot import backend code, so the vocabulary is hand-
    // mirrored. A lockstep COMMENT is not a guard — this is. If the registry
    // gains a code and nobody updates the panel, the panel would silently
    // render an unlabelled group; this fails first, and names the difference.
    const mirrorPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../frontend/src/components/dashboard/ProjectCloseoutReadiness.tsx',
    );
    const source = readFileSync(mirrorPath, 'utf8');
    const block = source.match(
      /export const HANDOVER_BLOCKING_REASON_CODES = \[([\s\S]*?)\] as const;/,
    );
    expect(block, 'the mirrored array must stay findable by this guard').not.toBeNull();

    const mirrored = [...block![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(mirrored).toEqual([...HANDOVER_BLOCKING_REASON_CODES]);

    // …and every mirrored code carries a label, so none renders as raw snake_case.
    const labels = source.match(
      /REASON_CODE_LABELS: Record<HandoverReasonCode, string> = \{([\s\S]*?)\n\};/,
    );
    expect(labels).not.toBeNull();
    const labelled = [...labels![1].matchAll(/^\s*([a-z_]+):/gm)].map((m) => m[1]);
    expect([...labelled].sort()).toEqual([...HANDOVER_BLOCKING_REASON_CODES].sort());
  });
});

describe('the project rollup unions, it does not re-derive', () => {
  it('is the union of its lots codes, in registry order, and ready only if all are', () => {
    const rollup = projectCloseoutVerdict('proj-1', [
      { subjectType: 'lot', subjectId: 'a', ready: false, reasonCodes: ['open_ncrs'] },
      { subjectType: 'lot', subjectId: 'b', ready: false, reasonCodes: ['no_itp_assigned'] },
      { subjectType: 'lot', subjectId: 'c', ready: true, reasonCodes: [] },
    ]);

    expect(rollup).toEqual({
      subjectType: 'project',
      subjectId: 'proj-1',
      ready: false,
      // Registry order: `no_itp_assigned` is index 0, `open_ncrs` index 3.
      reasonCodes: ['no_itp_assigned', 'open_ncrs'],
    });

    expect(
      projectCloseoutVerdict('proj-1', [
        { subjectType: 'lot', subjectId: 'a', ready: true, reasonCodes: [] },
      ]).ready,
    ).toBe(true);
  });
});

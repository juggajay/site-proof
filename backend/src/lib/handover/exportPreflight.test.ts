// Wave D `D1c.1` — the admission cap and the named unmeasured set.
// **AT-130** (the unit half; the "no row is written" half is DB-backed in
// `routes/handoverExports/handoverExport.db.test.ts`).
//
// Spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §4.5.3, §4.5.4.

import { describe, expect, it } from 'vitest';

import { AppError } from '../AppError.js';
import {
  ADMISSION_CAP_BYTES,
  assertAdmissible,
  assertMemberCountAdmissible,
  COMPRESSION_HEADROOM,
  EFFECTIVE_OUTPUT_CAP_BYTES,
  estimateExport,
  formatBytes,
  MEMBER_COUNT_LIMIT,
  UNMEASURED_MEMBER_ESTIMATE_BYTES,
  type PreflightMember,
} from './exportPreflight.js';

const GIB = 1024n ** 3n;

function members(
  count: number,
  byteSize: bigint | null,
  sourceType: PreflightMember['sourceType'] = 'document',
): PreflightMember[] {
  return Array.from({ length: count }, () => ({ sourceType, byteSize }));
}

describe('the decided numbers are the ones the spec wrote down (§4.5.3)', () => {
  it('caps output at 8 GiB and admission at 7.92 GiB of estimated input', () => {
    expect(EFFECTIVE_OUTPUT_CAP_BYTES).toBe(8 * 1024 ** 3);
    expect(COMPRESSION_HEADROOM).toBe(0.01);
    expect(ADMISSION_CAP_BYTES).toBe(Math.floor(8 * 1024 ** 3 * 0.99));
    // 7.92 GiB, stated in the spec's own units so a future edit to either
    // number has to explain itself here.
    expect(ADMISSION_CAP_BYTES / 1024 ** 3).toBeCloseTo(7.92, 2);
  });

  it('limits members at 8,334 — the count the §4.5.7 re-grade measured', () => {
    expect(MEMBER_COUNT_LIMIT).toBe(8334);
  });
});

describe('the estimate names its unmeasured set (§4.5.4)', () => {
  it('sums measured sizes and estimates the rest at a declared conservative ceiling', () => {
    const estimate = estimateExport([
      ...members(2, 1024n),
      ...members(3, null, 'holdpoint_signature'),
    ]);

    expect(estimate.measuredBytes).toBe(2048n);
    expect(estimate.unmeasuredMemberCount).toBe(3);
    expect(estimate.estimatedInputBytes).toBe(
      2048n + 3n * BigInt(UNMEASURED_MEMBER_ESTIMATE_BYTES.holdpoint_signature!),
    );
    expect(estimate.memberCount).toBe(5);
  });

  it('states the assumption, because a number with a hidden estimate in it is a lie', () => {
    const withUnmeasured = estimateExport(members(1, null, 'holdpoint_evidence'));
    expect(withUnmeasured.unmeasuredAssumption).toMatch(/conservative ceiling/);
    expect(withUnmeasured.unmeasuredAssumption).toMatch(/1 MiB/);

    const allMeasured = estimateExport(members(1, 10n));
    expect(allMeasured.unmeasuredAssumption).toMatch(/nothing was estimated/);
  });

  it('estimates a signature far below a document — one blanket number would refuse every real project', () => {
    // 5,000 signatures at the document ceiling would be 244 GiB and every
    // project would be refused; at the signature ceiling it is 4.9 GiB.
    expect(UNMEASURED_MEMBER_ESTIMATE_BYTES.holdpoint_signature).toBeLessThan(
      UNMEASURED_MEMBER_ESTIMATE_BYTES.document!,
    );
    expect(estimateExport(members(5000, null, 'holdpoint_signature')).withinCap).toBe(true);
  });

  it('counts in BigInt, because §4.5.5 is about Postgres INTEGER, not JS numbers', () => {
    // `fileSize Int` caps at 2,147,483,647 bytes — 2 GiB. Every byte count in
    // this feature routinely exceeds it, which is why the columns and this
    // arithmetic are `BigInt`. (JS `Number` would have coped; the DB would not.)
    const huge = estimateExport(members(4, 4n * GIB));
    expect(huge.estimatedInputBytes).toBe(16n * GIB);
    expect(huge.estimatedInputBytes > 2_147_483_647n).toBe(true);
    expect(huge.withinCap).toBe(false);
  });
});

describe('**AT-130** — the cap refuses, it does not truncate', () => {
  it('admits a scope at exactly the cap', () => {
    const estimate = estimateExport(members(1, BigInt(ADMISSION_CAP_BYTES)));
    expect(estimate.withinCap).toBe(true);
    expect(() => assertAdmissible(estimate, 'project')).not.toThrow();
  });

  it('refuses one byte over, with the estimate, the unmeasured count and the assumption', () => {
    const estimate = estimateExport([
      { sourceType: 'document', byteSize: BigInt(ADMISSION_CAP_BYTES) },
      { sourceType: 'holdpoint_signature', byteSize: null },
    ]);

    let thrown: AppError | undefined;
    try {
      assertAdmissible(estimate, 'project');
    } catch (error) {
      thrown = error as AppError;
    }

    expect(thrown).toBeInstanceOf(AppError);
    expect(thrown!.statusCode).toBe(400);
    expect(thrown!.code).toBe('HANDOVER_EXPORT_OVER_CAP');
    // Every one of the three things §4.5.4 requires the refusal to state.
    expect(thrown!.details!.estimatedInputBytes).toBe(estimate.estimatedInputBytes.toString());
    expect(thrown!.details!.unmeasuredMemberCount).toBe(1);
    expect(String(thrown!.details!.unmeasuredAssumption)).toMatch(/conservative ceiling/);
  });

  it('names the narrower scope that would fit, not just the number that did not (§4.7.6)', () => {
    const estimate = estimateExport(members(6, BigInt(ADMISSION_CAP_BYTES)));
    expect(estimate.archivesImpliedAtCap).toBe(6);

    expect(() => assertAdmissible(estimate, 'project')).toThrow(/about 6 archives/);
    expect(() => assertAdmissible(estimate, 'project')).toThrow(/by area or by lot range/);
  });

  it('never returns a truncated member set — refusal is the only over-cap outcome', () => {
    // There is deliberately no `assertAdmissible` overload, option or flag that
    // trims members to fit. This asserts the SHAPE of the API: the only exit
    // from an over-cap estimate is a throw.
    const estimate = estimateExport(members(2, 5n * GIB));
    expect(estimate.withinCap).toBe(false);
    expect(() => assertAdmissible(estimate, 'project')).toThrow(AppError);
  });
});

describe('the member-count limit refuses on its own', () => {
  it('admits exactly the limit and refuses one more', () => {
    expect(() => assertMemberCountAdmissible(MEMBER_COUNT_LIMIT, 'project')).not.toThrow();

    let thrown: AppError | undefined;
    try {
      assertMemberCountAdmissible(MEMBER_COUNT_LIMIT + 1, 'project');
    } catch (error) {
      thrown = error as AppError;
    }
    expect(thrown!.code).toBe('HANDOVER_EXPORT_MEMBER_LIMIT');
    expect(thrown!.details!.memberCount).toBe(MEMBER_COUNT_LIMIT + 1);
  });

  it('gives the pre-enumeration guard and the post-enumeration check one message', () => {
    // The freeze refuses on a cheap COUNT before it reads anything into memory,
    // and again on the exact count afterwards. Both go through this function,
    // so a caller cannot receive two different explanations of one limit.
    const fromGuard = captureMessage(() =>
      assertMemberCountAdmissible(MEMBER_COUNT_LIMIT + 1, 'project', { countIsUpperBound: true }),
    );
    const fromEstimate = captureMessage(() =>
      assertAdmissible(estimateExport(members(MEMBER_COUNT_LIMIT + 1, 0n)), 'project'),
    );
    expect(fromGuard).toBe(fromEstimate);
  });
});

describe('formatBytes uses binary units throughout (§4.5.3)', () => {
  it('renders GiB above 0.1 GiB and MiB below it', () => {
    expect(formatBytes(8n * GIB)).toBe('8.0 GiB');
    expect(formatBytes(BigInt(ADMISSION_CAP_BYTES))).toBe('7.9 GiB');
    expect(formatBytes(5n * 1024n * 1024n)).toBe('5.0 MiB');
  });
});

function captureMessage(fn: () => void): string {
  try {
    fn();
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error('expected a refusal');
}

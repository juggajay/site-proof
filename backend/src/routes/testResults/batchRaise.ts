/**
 * Raise every outstanding test for one or more of a lot's frequency rules, in
 * one action.
 *
 * SEMANTICS — CONVERGENT, NOT PARAMETERISED. The caller names the RULES, never a
 * count: the server computes `outstanding = required − passing − pending` and
 * creates exactly that many rows. That is what makes the endpoint retry-safe
 * without a durable request key. A lost-response retry re-evaluates the lot,
 * finds the rows it created the first time sitting in `pending`, computes
 * `outstanding = 0`, and creates nothing. A partial raise ("give me 3 of the 6")
 * would break exactly that property — after a lost response the second call
 * cannot tell 3-already-made from 3-still-wanted — so it is deliberately not
 * offered. Adding it later means adding the durable key column too.
 *
 * `ponytail:` the convergence window is the read-then-write gap, so two
 * SIMULTANEOUS calls can both see `outstanding = 6` and create 12. That is a
 * double-click race, not a retry, and the fix if it ever bites is a unique
 * `(lot, rule, sequence)` key — a migration, deliberately not taken here.
 *
 * ALL-OR-NOTHING. Every request entry is validated before anything is written,
 * and the writes go in one `$transaction`. A payload naming one good rule and
 * one bad one creates zero rows.
 *
 * The raised rows carry the RULE'S OWN `testType`, so they attribute back to the
 * rule that asked for them: `evaluate.ts` resolves both sides through the same
 * category resolver, so a row created with `rule.testType` is counted by that
 * rule by construction. A caller-supplied `testType` is allowed only when it
 * resolves to the same category — a free-text type that would count toward
 * nothing is a validation error here rather than a row that quietly never moves
 * the denominator.
 */

import type { Prisma } from '@prisma/client';

import { AppError } from '../../lib/AppError.js';
import { prisma } from '../../lib/prisma.js';
import {
  createCategoryResolver,
  ruleCategoryOf,
} from '../../lib/readiness/sufficiency/testCategories.js';
import { buildLotTestRequirements, type LotTestRequirementRule } from './lotRequirements.js';
import { MAX_TEST_ID_LENGTH, MAX_TEST_TYPE_LENGTH, normalizeRequiredString } from './validation.js';

/** A whole batch is one field action. Well above any real lot's requirement. */
export const MAX_BATCH_RAISE_ROWS = 50;

export interface BatchRaiseRequestEntry {
  ruleId: string;
  /** Optional override; must resolve to the rule's own test category. */
  testType?: string | null;
}

export interface BatchRaiseCreated {
  ruleId: string;
  testType: string;
  count: number;
  testResultIds: string[];
}

/** One validated entry, ready to write. */
interface PlannedRaise {
  ruleId: string;
  testType: string;
  count: number;
}

function parseEntries(value: unknown): BatchRaiseRequestEntry[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw AppError.badRequest('requests must be a non-empty array', { code: 'REQUESTS_REQUIRED' });
  }

  const entries = value.map((raw, index) => {
    if (!raw || typeof raw !== 'object') {
      throw AppError.badRequest(`requests[${index}] must be an object`, {
        code: 'REQUEST_INVALID',
      });
    }
    const entry = raw as { ruleId?: unknown; testType?: unknown };
    return {
      ruleId: normalizeRequiredString(
        entry.ruleId,
        `requests[${index}].ruleId`,
        MAX_TEST_ID_LENGTH,
      ),
      testType:
        entry.testType === undefined || entry.testType === null
          ? null
          : normalizeRequiredString(
              entry.testType,
              `requests[${index}].testType`,
              MAX_TEST_TYPE_LENGTH,
            ),
    };
  });

  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.ruleId)) {
      throw AppError.badRequest(`requests names rule ${entry.ruleId} more than once`, {
        code: 'DUPLICATE_RULE',
      });
    }
    seen.add(entry.ruleId);
  }

  return entries;
}

/**
 * Validate one entry against the lot's evaluated rules. Throws rather than
 * skipping: a silently-dropped entry is a partial success, which this endpoint
 * does not have.
 */
function planEntry(entry: BatchRaiseRequestEntry, rules: LotTestRequirementRule[]): PlannedRaise {
  const rule = rules.find((candidate) => candidate.ruleId === entry.ruleId);
  if (!rule) {
    throw AppError.badRequest(`No frequency rule ${entry.ruleId} applies to this lot`, {
      code: 'RULE_NOT_APPLICABLE',
      ruleId: entry.ruleId,
    });
  }

  if (rule.requiredCount === null) {
    throw AppError.badRequest(
      `The required number of ${rule.testType} tests cannot be worked out for this lot yet`,
      { code: 'REQUIREMENT_UNKNOWN', ruleId: rule.ruleId, unknownCauses: rule.unknownCauses },
    );
  }

  const testType = entry.testType ?? rule.testType;
  if (entry.testType) {
    const resolve = createCategoryResolver();
    const wanted = ruleCategoryOf(resolve, rule.testType);
    const supplied = ruleCategoryOf(resolve, entry.testType);
    if (wanted === null || supplied !== wanted) {
      throw AppError.badRequest(
        `"${entry.testType}" does not count toward the ${rule.testType} requirement`,
        { code: 'TEST_TYPE_MISMATCH', ruleId: rule.ruleId },
      );
    }
  }

  return { ruleId: rule.ruleId, testType, count: rule.outstandingCount };
}

/**
 * The lot the rows will hang off. Loaded separately from the requirement
 * summary because the create needs `projectId`, which the summary has no reason
 * to carry.
 */
export async function loadRaiseLot(lotId: string, client: typeof prisma = prisma) {
  return client.lot.findUnique({ where: { id: lotId }, select: { id: true, projectId: true } });
}

export async function planBatchRaise(
  lotId: string,
  requests: unknown,
  client: typeof prisma = prisma,
): Promise<PlannedRaise[]> {
  const entries = parseEntries(requests);
  const requirements = await buildLotTestRequirements(lotId, client);
  if (!requirements) throw AppError.notFound('Lot');

  const planned = entries.map((entry) => planEntry(entry, requirements.rules));

  const total = planned.reduce((sum, item) => sum + item.count, 0);
  if (total > MAX_BATCH_RAISE_ROWS) {
    throw AppError.badRequest(
      `Raising ${total} tests at once is more than the ${MAX_BATCH_RAISE_ROWS} this action allows`,
      { code: 'BATCH_TOO_LARGE' },
    );
  }

  return planned;
}

/**
 * Write the planned rows in one transaction. Rows are created individually
 * rather than through `createMany` so their ids come back for the audit trail;
 * the batch is capped at {@link MAX_BATCH_RAISE_ROWS}, so this is a bounded
 * number of statements inside one transaction.
 */
export async function writeRaisedTests(
  planned: PlannedRaise[],
  lot: { id: string; projectId: string },
  client: typeof prisma = prisma,
): Promise<BatchRaiseCreated[]> {
  const rows: { ruleId: string; data: Prisma.TestResultUncheckedCreateInput }[] = [];
  for (const item of planned) {
    for (let index = 0; index < item.count; index += 1) {
      rows.push({
        ruleId: item.ruleId,
        data: {
          projectId: lot.projectId,
          lotId: lot.id,
          testType: item.testType,
          passFail: 'pending',
          status: 'requested',
        },
      });
    }
  }

  const written = rows.length
    ? await client.$transaction(
        rows.map((row) => client.testResult.create({ data: row.data, select: { id: true } })),
      )
    : [];

  return planned.map((item) => ({
    ruleId: item.ruleId,
    testType: item.testType,
    count: item.count,
    testResultIds: written
      .filter((_, index) => rows[index]?.ruleId === item.ruleId)
      .map((row) => row.id),
  }));
}

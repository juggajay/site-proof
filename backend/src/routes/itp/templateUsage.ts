import { AppError } from '../../lib/AppError.js';

/**
 * Usage guard for replacing an ITP template's checklist items.
 *
 * Replacing checklist items deletes every existing `ITPChecklistItem` row for the
 * template and re-creates them with fresh ids. But sign-off records reference those
 * items by id with `onDelete: Restrict` (`ITPCompletion.checklistItem` and
 * `HoldPoint.itpChecklistItem`), so the moment a single item has been signed off on
 * any lot the delete is rejected by the database and the whole PATCH transaction
 * aborts with an opaque 500. `TestResult.itpChecklistItem` is `onDelete: SetNull`, so
 * it would not abort the delete, but a recorded test result is still evidence that the
 * template is in active use, so we count it too.
 *
 * Instead of letting the delete blow up, the PATCH handler checks usage first and
 * returns a clear 409 explaining that an in-use template's checklist can't be changed.
 */

const TEMPLATE_IN_USE_CODE = 'TEMPLATE_IN_USE';

/**
 * Structural slice of the Prisma client used by the usage helpers.
 *
 * Counts come from `count()` and distinct-lot totals from `findMany` with
 * `distinct: ['lotId']` so the database does the aggregation instead of every
 * sign-off row being hydrated into memory. Completions carry their lot on
 * `ITPInstance` (whose `lotId` is unique per instance), so distinct completion
 * lots are read from the instance table directly rather than deduped in JS.
 */
export interface TemplateUsageClient {
  iTPCompletion: {
    count: (args: { where: { checklistItem: { templateId: string } } }) => Promise<number>;
  };
  iTPInstance: {
    findMany: (args: {
      where: { completions: { some: { checklistItem: { templateId: string } } } };
      select: { lotId: true };
    }) => Promise<Array<{ lotId: string }>>;
  };
  holdPoint: {
    count: (args: { where: { itpChecklistItem: { templateId: string } } }) => Promise<number>;
    findMany: (args: {
      where: { itpChecklistItem: { templateId: string } };
      select: { lotId: true };
      distinct: ['lotId'];
    }) => Promise<Array<{ lotId: string }>>;
  };
  testResult: {
    count: (args: { where: { itpChecklistItem: { templateId: string } } }) => Promise<number>;
    findMany: (args: {
      where: { itpChecklistItem: { templateId: string }; lotId: { not: null } };
      select: { lotId: true };
      distinct: ['lotId'];
    }) => Promise<Array<{ lotId: string | null }>>;
  };
}

export interface TemplateItemUsage {
  /** Total sign-off records (completions + hold points + test results) tied to the template's items. */
  referenceCount: number;
  /** Number of distinct lots with at least one of those records. */
  lotCount: number;
}

/**
 * Counts how many sign-off records reference the given template's checklist items, and
 * across how many distinct lots. A non-zero `referenceCount` means the checklist items
 * cannot be safely deleted and re-created.
 */
export async function countTemplateItemUsage(
  client: TemplateUsageClient,
  templateId: string,
): Promise<TemplateItemUsage> {
  const [
    completionCount,
    holdPointCount,
    testResultCount,
    completionLots,
    holdPointLots,
    testResultLots,
  ] = await Promise.all([
    client.iTPCompletion.count({ where: { checklistItem: { templateId } } }),
    client.holdPoint.count({ where: { itpChecklistItem: { templateId } } }),
    client.testResult.count({ where: { itpChecklistItem: { templateId } } }),
    client.iTPInstance.findMany({
      where: { completions: { some: { checklistItem: { templateId } } } },
      select: { lotId: true },
    }),
    client.holdPoint.findMany({
      where: { itpChecklistItem: { templateId } },
      select: { lotId: true },
      distinct: ['lotId'],
    }),
    client.testResult.findMany({
      where: { itpChecklistItem: { templateId }, lotId: { not: null } },
      select: { lotId: true },
      distinct: ['lotId'],
    }),
  ]);

  const lotIds = new Set<string>();
  for (const { lotId } of completionLots) lotIds.add(lotId);
  for (const { lotId } of holdPointLots) lotIds.add(lotId);
  for (const { lotId } of testResultLots) {
    if (lotId) lotIds.add(lotId);
  }

  return {
    referenceCount: completionCount + holdPointCount + testResultCount,
    lotCount: lotIds.size,
  };
}

/** Plain-English 409 message for an in-use template, sized for the lot count. */
export function buildTemplateInUseMessage(lotCount: number): string {
  const lotLabel = lotCount === 1 ? 'lot' : 'lots';
  return (
    `This template is in use by ${lotCount} ${lotLabel} with recorded sign-offs, ` +
    `so its checklist items can't be changed. Duplicate the template and edit the copy.`
  );
}

/**
 * Throws a 409 `TEMPLATE_IN_USE` error if the template's checklist items are referenced
 * by any sign-off record. Call this before deleting/replacing checklist items so the
 * caller never attempts a delete the database would reject.
 */
export async function assertTemplateItemsReplaceable(
  client: TemplateUsageClient,
  templateId: string,
): Promise<void> {
  const usage = await countTemplateItemUsage(client, templateId);
  if (usage.referenceCount > 0) {
    throw new AppError(409, buildTemplateInUseMessage(usage.lotCount), TEMPLATE_IN_USE_CODE, {
      code: TEMPLATE_IN_USE_CODE,
      lotCount: usage.lotCount,
      referenceCount: usage.referenceCount,
    });
  }
}

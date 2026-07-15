/**
 * Activity-aware bulk lot creation assigns each lot its own ITP template: a
 * Pavement lot gets the Pavement ITP, an Earthworks lot the Earthworks ITP.
 * The Lot model still has a single itpTemplateId FK, so "per-lot templates"
 * just means each lot in the batch may carry its own id.
 *
 * The batch-level itpTemplateId remains a default for lots that omit their own
 * (backward-compatible with the single-template payload and the CSV importer).
 */
export function bulkLotEffectiveTemplateId(
  lot: { itpTemplateId?: string | null },
  batchTemplateId: string | null | undefined,
): string | null {
  return lot.itpTemplateId ?? batchTemplateId ?? null;
}

export interface BulkItpPlan {
  /** Distinct template ids referenced by the batch — validate/snapshot each once. */
  distinctTemplateIds: string[];
  /** Effective template id per lot, keyed by lotNumber (null = no ITP for that lot). */
  templateIdByLotNumber: Map<string, string | null>;
}

/**
 * Resolve which ITP template each lot should receive. Single-template batches
 * (only a batch default, no per-lot ids) map every lot to that default — the
 * exact behaviour before per-lot templates existed.
 */
export function planBulkItpTemplates(
  lots: { lotNumber: string; itpTemplateId?: string | null }[],
  batchTemplateId: string | null | undefined,
): BulkItpPlan {
  const templateIdByLotNumber = new Map<string, string | null>();
  const distinct = new Set<string>();
  for (const lot of lots) {
    const effective = bulkLotEffectiveTemplateId(lot, batchTemplateId);
    templateIdByLotNumber.set(lot.lotNumber, effective);
    if (effective) distinct.add(effective);
  }
  return { distinctTemplateIds: [...distinct], templateIdByLotNumber };
}

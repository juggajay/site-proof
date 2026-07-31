export interface ChecklistItem {
  id: string;
  description?: string | null;
  sequenceNumber?: number | null;
  pointType?: string | null;
  responsibleParty?: string | null;
  evidenceRequired?: string | null;
  acceptanceCriteria?: string | null;
  testType?: string | null;
  /**
   * Wave G G2 (spec §0.2 Finding 2 / §2.2(d)). Every seeder parks its clause
   * citation here — 'MRWA Spec 820.06 HOLD.', 'Clause 5.2 - No earthworks to
   * commence…'. Dropping it meant a conformed lot could not say which
   * specification clause it was inspected against, which is the exact thing the
   * snapshot exists to prove.
   */
  notes?: string | null;
}

export interface TemplateSnapshot {
  id: string;
  name: string;
  description?: string | null;
  activityType?: string | null;
  /**
   * Wave G G2 (spec §2.2(d)) — the specification the template was written
   * against, and when this capture happened. `snapshotAt` is what finally gives
   * a snapshot something to be compared TO.
   *
   * All optional: a snapshot written before G2 carries none of them and reads
   * back as null rather than being rewritten. Existing snapshots are never
   * rewritten — a lot conformed under the old snapshot keeps exactly the bytes
   * it had.
   */
  specificationReference?: string | null;
  stateSpec?: string | null;
  authority?: string | null;
  specEdition?: string | null;
  snapshotAt?: string | null;
  /**
   * Set ONLY by the one-off backfill script (`scripts/backfill-itp-snapshots.mjs`),
   * so a reconstructed snapshot is never mistaken for a genuine assignment-time
   * capture. Absent on every snapshot the application writes.
   */
  backfilledAt?: string | null;
  checklistItems: ChecklistItem[];
}

export interface TemplateSnapshotSource {
  id: string;
  name: string;
  description?: string | null;
  activityType?: string | null;
  specificationReference?: string | null;
  stateSpec?: string | null;
  authority?: string | null;
  specEdition?: string | null;
  checklistItems: ChecklistItem[];
}

export interface BuildTemplateSnapshotOptions {
  /** Capture instant. Defaults to now; injected by tests and by the backfill. */
  snapshotAt?: Date;
  /** Backfill marker (spec §2.2(d) / AT-G12). Omitted by every live write path. */
  backfilledAt?: Date;
}

interface TemplateWithOptionalChecklistItems {
  checklistItems?: ChecklistItem[] | null;
  [key: string]: unknown;
}

export const SUBCONTRACTOR_VISIBLE_RESPONSIBLE_PARTIES = new Set([
  'contractor',
  'subcontractor',
  'general',
]);

export function buildTemplateSnapshot(
  template: TemplateSnapshotSource,
  options: BuildTemplateSnapshotOptions = {},
): TemplateSnapshot {
  return {
    id: template.id,
    name: template.name,
    description: template.description ?? null,
    activityType: template.activityType ?? null,
    specificationReference: template.specificationReference ?? null,
    stateSpec: template.stateSpec ?? null,
    authority: template.authority ?? null,
    specEdition: template.specEdition ?? null,
    snapshotAt: (options.snapshotAt ?? new Date()).toISOString(),
    ...(options.backfilledAt ? { backfilledAt: options.backfilledAt.toISOString() } : {}),
    checklistItems: [...template.checklistItems]
      .sort((a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0))
      .map((item) => ({
        id: item.id,
        description: item.description ?? null,
        sequenceNumber: item.sequenceNumber ?? null,
        pointType: item.pointType ?? null,
        responsibleParty: item.responsibleParty ?? null,
        evidenceRequired: item.evidenceRequired ?? null,
        acceptanceCriteria: item.acceptanceCriteria ?? null,
        testType: item.testType ?? null,
        notes: item.notes ?? null,
      })),
  };
}

export function parseTemplateSnapshot(
  templateSnapshot: string | null | undefined,
): TemplateSnapshot | null {
  if (!templateSnapshot) {
    return null;
  }

  try {
    const parsed = JSON.parse(templateSnapshot) as Partial<TemplateSnapshot>;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.checklistItems)) {
      return null;
    }

    // The parser reconstructs field by field — there is no spread here, and
    // that is deliberate (unknown top-level keys are dropped, not trusted). It
    // also means EVERY field added to `buildTemplateSnapshot` must be added
    // here too, or it evaporates on read with green tests. Wave G G2 [GR-A4].
    return {
      id: typeof parsed.id === 'string' ? parsed.id : '',
      name: typeof parsed.name === 'string' ? parsed.name : '',
      description: parsed.description ?? null,
      activityType: parsed.activityType ?? null,
      specificationReference: parsed.specificationReference ?? null,
      stateSpec: parsed.stateSpec ?? null,
      authority: parsed.authority ?? null,
      specEdition: parsed.specEdition ?? null,
      snapshotAt: parsed.snapshotAt ?? null,
      backfilledAt: parsed.backfilledAt ?? null,
      checklistItems: parsed.checklistItems.filter(
        (item): item is ChecklistItem =>
          !!item && typeof item === 'object' && typeof item.id === 'string',
      ),
    };
  } catch (_error) {
    return null;
  }
}

export function getChecklistItemsForInstance(instance: {
  templateSnapshot?: string | null;
  template?: TemplateWithOptionalChecklistItems | null;
}): ChecklistItem[] {
  const snapshot = parseTemplateSnapshot(instance.templateSnapshot);
  if (snapshot) {
    return snapshot.checklistItems;
  }

  return instance.template?.checklistItems ?? [];
}

export function resolveChecklistItemForInstance(
  instance: {
    templateSnapshot?: string | null;
    template?: TemplateWithOptionalChecklistItems | null;
  },
  checklistItemId: string,
  liveFallback?: ChecklistItem | null,
): ChecklistItem | null {
  const snapshot = parseTemplateSnapshot(instance.templateSnapshot);
  if (snapshot) {
    return snapshot.checklistItems.find((item) => item.id === checklistItemId) ?? null;
  }

  return (
    instance.template?.checklistItems?.find((item) => item.id === checklistItemId) ??
    liveFallback ??
    null
  );
}

export function isSubcontractorVisibleChecklistItem(item: {
  responsibleParty?: string | null;
}): boolean {
  return SUBCONTRACTOR_VISIBLE_RESPONSIBLE_PARTIES.has(item.responsibleParty ?? '');
}

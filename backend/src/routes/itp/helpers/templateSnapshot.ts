export interface ChecklistItem {
  id: string;
  description?: string | null;
  sequenceNumber?: number | null;
  pointType?: string | null;
  responsibleParty?: string | null;
  evidenceRequired?: string | null;
  acceptanceCriteria?: string | null;
  testType?: string | null;
}

export interface TemplateSnapshot {
  id: string;
  name: string;
  description?: string | null;
  activityType?: string | null;
  checklistItems: ChecklistItem[];
}

export interface TemplateSnapshotSource {
  id: string;
  name: string;
  description?: string | null;
  activityType?: string | null;
  checklistItems: ChecklistItem[];
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

export function buildTemplateSnapshot(template: TemplateSnapshotSource): TemplateSnapshot {
  return {
    id: template.id,
    name: template.name,
    description: template.description ?? null,
    activityType: template.activityType ?? null,
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

    return {
      id: typeof parsed.id === 'string' ? parsed.id : '',
      name: typeof parsed.name === 'string' ? parsed.name : '',
      description: parsed.description ?? null,
      activityType: parsed.activityType ?? null,
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

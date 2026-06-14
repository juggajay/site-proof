import {
  getChecklistItemsForInstance,
  parseTemplateSnapshot,
  resolveChecklistItemForInstance,
  type ChecklistItem,
} from '../itp/helpers/templateSnapshot.js';

export type HoldPointChecklistItem = {
  id: string;
  description: string;
  sequenceNumber: number;
  pointType: string;
  responsibleParty: string;
  evidenceRequired: string | null;
  acceptanceCriteria: string | null;
  testType: string | null;
};

export type HoldPointItpTemplate = {
  id: string;
  name: string;
  activityType: string | null;
};

type HoldPointTemplateSource = {
  id?: string;
  name?: string;
  activityType?: string | null;
  checklistItems?: ChecklistItem[] | null;
} | null;

export type HoldPointItpInstanceSource = {
  templateSnapshot?: string | null;
  template?: HoldPointTemplateSource;
};

function normalizeChecklistItem(item: ChecklistItem): HoldPointChecklistItem {
  return {
    id: item.id,
    description: item.description ?? '',
    sequenceNumber: item.sequenceNumber ?? 0,
    pointType: item.pointType ?? 'standard',
    responsibleParty: item.responsibleParty ?? 'contractor',
    evidenceRequired: item.evidenceRequired ?? null,
    acceptanceCriteria: item.acceptanceCriteria ?? null,
    testType: item.testType ?? null,
  };
}

export function getHoldPointChecklistItemsForInstance(
  instance: HoldPointItpInstanceSource,
): HoldPointChecklistItem[] {
  return getChecklistItemsForInstance(instance).map(normalizeChecklistItem);
}

export function resolveHoldPointChecklistItemForInstance(
  instance: HoldPointItpInstanceSource,
  checklistItemId: string,
  liveFallback?: ChecklistItem | null,
): HoldPointChecklistItem | null {
  const item = resolveChecklistItemForInstance(instance, checklistItemId, liveFallback);
  return item ? normalizeChecklistItem(item) : null;
}

export function getHoldPointItpTemplateForInstance(
  instance: HoldPointItpInstanceSource,
): HoldPointItpTemplate | null {
  const snapshot = parseTemplateSnapshot(instance.templateSnapshot);
  if (snapshot) {
    return {
      id: snapshot.id,
      name: snapshot.name,
      activityType: snapshot.activityType ?? null,
    };
  }

  if (!instance.template?.id || !instance.template.name) {
    return null;
  }

  return {
    id: instance.template.id,
    name: instance.template.name,
    activityType: instance.template.activityType ?? null,
  };
}

import { AppError } from '../../lib/AppError.js';
import type { ChecklistItem } from '../itp/helpers/templateSnapshot.js';
import {
  getHoldPointChecklistItemsForInstance,
  getHoldPointItpTemplateForInstance,
  resolveHoldPointChecklistItemForInstance,
  type HoldPointItpInstanceSource,
} from './itpSnapshot.js';

type ResolveHoldPointEvidenceInputsParams<TItpInstance extends HoldPointItpInstanceSource> = {
  itpInstance: TItpInstance | null | undefined;
  checklistItemId: string;
  liveFallback?: ChecklistItem | null;
};

export function resolveHoldPointEvidenceInputs<TItpInstance extends HoldPointItpInstanceSource>({
  itpInstance,
  checklistItemId,
  liveFallback,
}: ResolveHoldPointEvidenceInputsParams<TItpInstance>) {
  if (!itpInstance) {
    throw AppError.badRequest('No ITP assigned to this lot');
  }

  const checklistItems = getHoldPointChecklistItemsForInstance(itpInstance);
  const holdPointItem = resolveHoldPointChecklistItemForInstance(
    itpInstance,
    checklistItemId,
    liveFallback,
  );
  if (!holdPointItem) {
    throw AppError.notFound('Hold point checklist item');
  }

  const itpTemplate = getHoldPointItpTemplateForInstance(itpInstance);
  if (!itpTemplate) {
    throw AppError.badRequest('No ITP template assigned to this lot');
  }

  return { itpInstance, checklistItems, holdPointItem, itpTemplate };
}

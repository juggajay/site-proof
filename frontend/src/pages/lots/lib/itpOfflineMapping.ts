/**
 * Pure ITP offline-cache mappers, extracted verbatim from LotDetailPage.tsx's
 * `fetchItpInstance`. No component state, data fetching, IndexedDB access, or
 * toasts live here — the page still owns those and calls these helpers in place.
 *
 * `mapInstanceToOfflineItems` projects a server ITP instance into the rows the
 * page writes to the offline cache. `mapCachedToItpInstance` reverses that,
 * rebuilding a synthetic `ITPInstance` from cached rows for offline display.
 * The offline row shape only persists `isHoldPoint` (a boolean), so the granular
 * `pointType` (witness vs standard) does NOT survive the round-trip — a witness
 * point comes back as `standard`. See itpOfflineMapping.test.ts.
 *
 * `@/lib/offlineDb` is imported type-only so this module never pulls Dexie /
 * IndexedDB into its runtime graph.
 */
import type { ITPChecklistItem, ITPCompletion, ITPInstance } from '../types';
import type {
  ItpCompletionServerBase,
  OfflineChecklistItem,
  OfflineITPChecklist,
} from '@/lib/offlineDb';
import { normalizeResponsibleParty } from './itpEvidence';

function completionStatusForCache(completion?: ITPCompletion): OfflineChecklistItem['status'] {
  if (!completion) {
    return 'pending';
  }
  if (completion.status === 'completed') return 'completed';
  if (completion.status === 'not_applicable') return 'na';
  if (completion.status === 'failed') return 'failed';
  if (completion.isFailed) return 'failed';
  if (completion.isNotApplicable) return 'na';
  if (completion.isCompleted) return 'completed';
  return 'pending';
}

function serverStatusForCache(
  status: OfflineChecklistItem['status'],
): ItpCompletionServerBase['status'] {
  return status === 'na' ? 'not_applicable' : status;
}

function buildServerCompletionBase(
  completion: ITPCompletion | undefined,
  status: OfflineChecklistItem['status'],
): ItpCompletionServerBase {
  if (!completion) {
    return { exists: false };
  }

  return {
    exists: true,
    id: completion.id,
    status: serverStatusForCache(status),
    notes: completion.notes ?? null,
    completedAt: completion.completedAt ?? null,
  };
}

/**
 * Project a server `ITPInstance` into `OfflineChecklistItem[]` for caching.
 * Status is derived from the matching completion with the explicit status first,
 * then failed/N-A before completed because backend N/A responses also set
 * `isCompleted: true`. Falls back to `pending` when there is no completion (or
 * no flag is set). Caller guards `instance.template` before invoking.
 */
export function mapInstanceToOfflineItems(instance: ITPInstance): OfflineChecklistItem[] {
  return instance.template.checklistItems.map((item: ITPChecklistItem) => {
    const completion = instance.completions.find(
      (c: ITPCompletion) => c.checklistItemId === item.id,
    );
    const status = completionStatusForCache(completion);

    return {
      id: item.id,
      name: item.description,
      description: item.acceptanceCriteria || undefined,
      responsibleParty: item.responsibleParty,
      isHoldPoint: item.isHoldPoint,
      status,
      notes: completion?.notes || undefined,
      completedAt: completion?.completedAt || undefined,
      completedBy: completion?.completedBy?.fullName || undefined,
      serverCompletionBase: buildServerCompletionBase(completion, status),
    };
  });
}

/**
 * Rebuild a synthetic `ITPInstance` from a cached offline checklist for display
 * when the network fetch fails. Items become virtual checklist items (with
 * `pointType` derived from `isHoldPoint`); non-pending items become synthetic
 * completions. Caller sets `isOfflineData` and surfaces the cache age.
 */
export function mapCachedToItpInstance(cached: OfflineITPChecklist): ITPInstance {
  return {
    id: `offline-${cached.id}`,
    template: {
      id: cached.templateId,
      name: cached.templateName,
      checklistItems: cached.items.map((item, index) => ({
        id: item.id,
        description: item.name,
        category: 'General',
        responsibleParty: normalizeResponsibleParty(item.responsibleParty),
        isHoldPoint: item.isHoldPoint,
        pointType: item.isHoldPoint ? 'hold_point' : 'standard',
        evidenceRequired: 'none',
        order: index,
        acceptanceCriteria: item.description || null,
        testType: null,
      })),
    },
    completions: cached.items
      .filter((item) => item.status !== 'pending')
      .map((item) => ({
        id: `offline-${item.id}`,
        checklistItemId: item.id,
        isCompleted: item.status === 'completed',
        isNotApplicable: item.status === 'na',
        isFailed: item.status === 'failed',
        notes: item.notes || null,
        completedAt: item.completedAt || null,
        completedBy: item.completedBy
          ? { id: 'offline', fullName: item.completedBy, email: '' }
          : null,
        isVerified: false,
        verifiedAt: null,
        verifiedBy: null,
        attachments: [],
      })),
  };
}

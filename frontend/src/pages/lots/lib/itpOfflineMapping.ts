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
import type { OfflineChecklistItem, OfflineITPChecklist } from '@/lib/offlineDb';
import { normalizeResponsibleParty } from './itpEvidence';

/**
 * Project a server `ITPInstance` into `OfflineChecklistItem[]` for caching.
 * Status is derived from the matching completion with completed > na > failed
 * precedence, falling back to `pending` when there is no completion (or no flag
 * is set). Caller guards `instance.template` before invoking.
 */
export function mapInstanceToOfflineItems(instance: ITPInstance): OfflineChecklistItem[] {
  return instance.template.checklistItems.map((item: ITPChecklistItem) => {
    const completion = instance.completions.find(
      (c: ITPCompletion) => c.checklistItemId === item.id,
    );
    let status: 'pending' | 'completed' | 'na' | 'failed' = 'pending';
    if (completion?.isCompleted) status = 'completed';
    else if (completion?.isNotApplicable) status = 'na';
    else if (completion?.isFailed) status = 'failed';

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

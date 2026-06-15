/**
 * itpCompletionWrite.ts — the online-then-offline ITP completion write, extracted
 * behavior-preserving from `useItpInstance.toggleCompletion` so BOTH the
 * LotDetailPage hook and the foreman shell run screen drive the exact same
 * request shape and field-write resilience from one tested place.
 *
 * This is the WRITE primitive only: it does NOT own the witness-point gate, the
 * evidence-warning gate, the double-submit ref, toasts, or any React state — the
 * caller keeps those. It performs the `POST /api/itp/completions` and, on a
 * retriable network failure (browser offline, timeout, fetch failure, or 5xx —
 * per `isRetriableNetworkFailure`), writes through to the offline cache + sync
 * queue and synthesises the optimistic completion exactly as the page hook did.
 * Definitive 4xx rejections are re-thrown for the caller's error UI.
 *
 * Returned discriminated result lets the caller toast appropriately:
 *   - { status: 'saved', completion }  — server confirmed; also write-through cached
 *   - { status: 'queued', completion } — offline; queued for sync, optimistic state
 */
import { apiFetch, isRetriableNetworkFailure } from '@/lib/api';
import { recordSyncedChecklistItem, updateChecklistItemOffline } from '@/lib/offlineDb';
import type { ITPCompletion } from '../types';

export type ItpCompletionWriteResult =
  | { status: 'saved'; completion: ITPCompletion }
  | { status: 'queued'; completion: ITPCompletion };

interface ItpCompletionWriteParams {
  itpInstanceId: string;
  lotId: string | undefined;
  checklistItemId: string;
  /** Current completed flag; the write toggles to its inverse. */
  currentlyCompleted: boolean;
  existingNotes: string | null;
  /** Witness attribution, forwarded verbatim when present (witness-point path). */
  witnessData?: { witnessPresent: boolean; witnessName?: string; witnessCompany?: string };
}

/**
 * Toggle an ITP item's completion online, falling back to the offline pipeline on
 * any retriable network failure. Caller owns gating, the in-flight guard, state
 * merge, and toasts. Throws on definitive (4xx) rejections.
 */
export async function writeItpCompletionToggle({
  itpInstanceId,
  lotId,
  checklistItemId,
  currentlyCompleted,
  existingNotes,
  witnessData,
}: ItpCompletionWriteParams): Promise<ItpCompletionWriteResult> {
  const nextCompleted = !currentlyCompleted;

  try {
    const data = await apiFetch<{ completion: ITPCompletion }>('/api/itp/completions', {
      method: 'POST',
      body: JSON.stringify({
        itpInstanceId,
        checklistItemId,
        isCompleted: nextCompleted,
        notes: existingNotes,
        ...(witnessData && {
          witnessPresent: witnessData.witnessPresent,
          witnessName: witnessData.witnessName || null,
          witnessCompany: witnessData.witnessCompany || null,
        }),
      }),
    });

    // Server-confirmed write-through to the offline cache (no sync entry queued).
    if (lotId) {
      await recordSyncedChecklistItem(
        lotId,
        checklistItemId,
        nextCompleted ? 'completed' : 'pending',
        existingNotes || undefined,
        'Current User',
        data.completion,
      );
    }

    return { status: 'saved', completion: data.completion };
  } catch (err) {
    // Only retriable network failures fall back to offline. 4xx rejections
    // (e.g. the hold-point guard) re-throw for the caller's error UI.
    if (!lotId || !isRetriableNetworkFailure(err)) throw err;

    await updateChecklistItemOffline(
      lotId,
      checklistItemId,
      nextCompleted ? 'completed' : 'pending',
      existingNotes || undefined,
      'Current User (Offline)',
    );

    const optimistic: ITPCompletion = {
      id: `offline-${checklistItemId}-${Date.now()}`,
      checklistItemId,
      isCompleted: nextCompleted,
      isNotApplicable: false,
      isFailed: false,
      notes: existingNotes,
      completedAt: nextCompleted ? new Date().toISOString() : null,
      completedBy: nextCompleted ? { id: 'offline', fullName: 'You (Offline)', email: '' } : null,
      isVerified: false,
      verifiedAt: null,
      verifiedBy: null,
      attachments: [],
    };

    return { status: 'queued', completion: optimistic };
  }
}

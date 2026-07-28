/**
 * SyncPanel — the Sync Centre sheet, opened by the SyncChip in both shell
 * headers (/m and /p). Read-only apart from ONE action: "Retry failed".
 *
 * No "Sync now": the chip's useOfflineStatus instance runs with
 * enableSyncWorker false, so syncPendingChanges() returns before doing anything
 * — that button would be inert. Retry works from any instance because it does
 * not flush; it writes attempts:0 to Dexie and the app-root worker picks the
 * rows up on its next poll.
 *
 * Presentational: every value arrives from the chip's hook instance as props,
 * so the panel cannot disagree with the chip that opened it, and opening it
 * starts no second poll (which would also flash zeros on open).
 */
import { AlertTriangle, BookOpen, Camera, ClipboardCheck, FileText, MapPin } from 'lucide-react';
import { BottomSheet } from '@/components/foreman/sheets/BottomSheet';
import { STUCK_SYNC_THRESHOLD_MS } from '@/lib/useOfflineStatus';
import {
  SYNC_KINDS,
  formatLastSynced,
  type SyncFailedItem,
  type SyncKind,
} from '@/lib/offline/syncKinds';
import { syncChipLabel, type SyncState } from './syncChipState';

// Icon + noun per kind, icons matching the hub tiles the kinds correspond to.
const KIND_ROW: Record<SyncKind, { icon: React.ElementType; one: string; many: string }> = {
  photos: { icon: Camera, one: 'photo', many: 'photos' },
  diary: { icon: BookOpen, one: 'diary entry', many: 'diary entries' },
  dockets: { icon: FileText, one: 'docket', many: 'dockets' },
  itp: { icon: ClipboardCheck, one: 'checklist item', many: 'checklist items' },
  defects: { icon: AlertTriangle, one: 'defect', many: 'defects' },
  lots: { icon: MapPin, one: 'lot change', many: 'lot changes' },
};

// Fallbacks for a dead-lettered row whose type predates the kind vocabulary.
const UNKNOWN_KIND_ROW = { icon: AlertTriangle, one: 'change', many: 'changes' };

export interface SyncPanelStatus {
  isOnline: boolean;
  pendingSyncCount: number;
  failedSyncCount: number;
  conflictCount: number;
  oldestPendingItemAge: number | null;
  pendingByKind: Record<SyncKind, number>;
  failedItems: SyncFailedItem[];
  lastSyncedAt: string | null;
  retryFailedSyncs: () => void | Promise<void>;
}

interface SyncPanelProps {
  isOpen: boolean;
  onClose: () => void;
  state: SyncState;
  status: SyncPanelStatus;
}

export function SyncPanel({ isOpen, onClose, state, status }: SyncPanelProps) {
  const { isOnline, pendingSyncCount, failedSyncCount, pendingByKind, lastSyncedAt } = status;
  const { oldestPendingItemAge, retryFailedSyncs, conflictCount, failedItems } = status;

  // Fixed kind order, never sorted by count: rows must not reshuffle mid-drain.
  // pendingByKind is LIVE rows only — a dead-lettered item has stopped, so it
  // gets its own "Needs attention" row below rather than a "Waiting" label.
  const rows = SYNC_KINDS.filter((kind) => (pendingByKind[kind] ?? 0) > 0);
  const onRetry = () => void retryFailedSyncs();

  // Same predicate as the floating pill, recomputed from the same three fields.
  const isStuck =
    isOnline &&
    pendingSyncCount > 0 &&
    oldestPendingItemAge !== null &&
    oldestPendingItemAge >= STUCK_SYNC_THRESHOLD_MS;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Sync">
      <div className="flex flex-col gap-4 pb-2">
        <div>
          {/* role=status moved here from the chip, which is now a button. */}
          <p role="status" className="shell-display-title text-[17px]">
            {syncChipLabel(state, pendingSyncCount, failedSyncCount, conflictCount)}
          </p>
          <p className="text-[13px] text-muted-foreground">
            {formatLastSynced(lastSyncedAt, Date.now())}
          </p>
        </div>
        {rows.length > 0 && (
          <ul className="flex flex-col gap-2">
            {rows.map((kind) => {
              const { icon: Icon, one, many } = KIND_ROW[kind];
              const count = pendingByKind[kind];
              return (
                <li key={kind} className="shell-hub">
                  <span className="shell-hub-ico" aria-hidden="true">
                    <Icon size={22} strokeWidth={1.8} />
                  </span>
                  <span className="shell-tile-title min-w-0 flex-1">
                    {count} {count === 1 ? one : many}
                  </span>
                  {/* No chevron — these rows navigate nowhere (decision D3). */}
                  <span className="shell-chip text-[10.5px]">Waiting</span>
                </li>
              );
            })}
          </ul>
        )}
        {/* Dead-lettered rows, each with the reason it stopped. `lastError` was
            captured on every failure and rendered nowhere until here, so the
            foreman could never learn WHY anything failed. These rows carry a
            second line on purpose — a failure without its reason is not
            actionable. */}
        {failedItems.length > 0 && (
          <ul className="flex flex-col gap-2">
            {failedItems.map((failure, index) => {
              const { icon: Icon, one } = failure.kind ? KIND_ROW[failure.kind] : UNKNOWN_KIND_ROW;
              return (
                <li key={failure.id ?? `failed-${index}`} className="shell-hub">
                  <span className="shell-hub-ico text-destructive" aria-hidden="true">
                    <Icon size={22} strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="shell-tile-title block">{one}</span>
                    {failure.message && (
                      <span className="block text-[12px] leading-snug text-muted-foreground">
                        {failure.message}
                      </span>
                    )}
                  </span>
                  <span className="shell-chip text-[10.5px] text-destructive">Needs attention</span>
                </li>
              );
            })}
          </ul>
        )}
        {conflictCount > 0 && (
          <p className="text-[13px] text-warning">
            {conflictCount} sync conflict{conflictCount === 1 ? '' : 's'} — someone else edited the
            same lot while you were offline. Tap Resolve on the sync banner to sort it out.
          </p>
        )}
        {failedSyncCount > 0 && (
          <p className="text-[13px] font-semibold text-destructive">
            {failedSyncCount} failed — tap Retry
          </p>
        )}
        {isStuck && (
          <p className="text-[13px] text-warning">
            Some items haven&apos;t synced yet — keep the app open while on signal
          </p>
        )}
        {!isOnline && (
          <p className="text-[13px] text-muted-foreground">
            You&apos;re offline. Everything here is saved on this phone and will upload when
            you&apos;re back on signal.
          </p>
        )}
        {failedSyncCount > 0 && (
          <button type="button" className="shell-primary-btn" onClick={onRetry}>
            Retry failed
          </button>
        )}
      </div>
    </BottomSheet>
  );
}

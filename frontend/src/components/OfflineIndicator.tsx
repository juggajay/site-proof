import { useState, useCallback } from 'react';
import { useOfflineStatus, type SyncCompleteResult } from '@/lib/useOfflineStatus';
import { WifiOff, RefreshCw, CloudOff, Check, AlertTriangle } from 'lucide-react';
import { SyncConflictModal } from './SyncConflictModal';
import { toast } from '@/components/ui/toaster';

export function OfflineIndicator() {
  const [showConflictModal, setShowConflictModal] = useState(false);

  // Callback when conflict is detected during sync
  const handleConflictDetected = useCallback(
    (_lotId: string, lotNumber: string, message: string) => {
      toast({
        title: `Sync Conflict: ${lotNumber}`,
        description: message,
        variant: 'warning',
        duration: 10000,
      });
      // Open conflict modal after a short delay
      setTimeout(() => setShowConflictModal(true), 500);
    },
    [],
  );

  // Callback when sync completes. Only celebrate when nothing was left behind:
  // if some items failed to sync, a separate "failed" indicator stays on screen,
  // so showing an "all synced" toast here would be misleading.
  const handleSyncComplete = useCallback(({ syncedCount, failedCount }: SyncCompleteResult) => {
    if (failedCount > 0) {
      return;
    }
    toast({
      title: 'Sync Complete',
      description: `Successfully synced ${syncedCount} change${syncedCount > 1 ? 's' : ''}.`,
      variant: 'success',
      duration: 5000,
    });
  }, []);

  const {
    isOnline,
    pendingSyncCount,
    failedSyncCount,
    isSyncing,
    syncPendingChanges,
    retryFailedSyncs,
    conflictCount,
  } = useOfflineStatus({
    onConflictDetected: handleConflictDetected,
    onSyncComplete: handleSyncComplete,
    enableSyncWorker: true,
  });

  // Don't show when online, synced, and no conflicts or failures
  if (isOnline && pendingSyncCount === 0 && conflictCount === 0 && failedSyncCount === 0) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end">
        {/* Conflict indicator */}
        {conflictCount > 0 && (
          <button
            onClick={() => setShowConflictModal(true)}
            className="flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-2 rounded-lg shadow-lg border border-amber-300 hover:bg-amber-200 transition-colors animate-pulse"
          >
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">
              {conflictCount} sync conflict{conflictCount > 1 ? 's' : ''}
            </span>
            <span className="text-xs bg-amber-200 px-2 py-0.5 rounded">Resolve</span>
          </button>
        )}

        {/* Failed sync indicator - items the server rejected too many times.
            They are kept (never deleted); the user can retry them here. */}
        {failedSyncCount > 0 && (
          <button
            onClick={retryFailedSyncs}
            disabled={isSyncing}
            className="flex items-center gap-2 bg-red-100 text-red-800 px-4 py-2 rounded-lg shadow-lg border border-red-300 hover:bg-red-200 transition-colors disabled:opacity-60"
          >
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">
              {failedSyncCount} item{failedSyncCount > 1 ? 's' : ''} failed to sync
            </span>
            <span className="text-xs bg-red-200 px-2 py-0.5 rounded">
              {isSyncing ? 'Retrying...' : 'Retry'}
            </span>
          </button>
        )}

        {/* Offline / Pending sync indicator */}
        {!isOnline ? (
          <div className="flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-2 rounded-lg shadow-lg border border-amber-200">
            <WifiOff className="h-4 w-4" />
            <span className="text-sm font-medium">Offline Mode</span>
            {pendingSyncCount > 0 && (
              <span className="bg-amber-200 px-2 py-0.5 rounded-full text-xs">
                {pendingSyncCount} pending
              </span>
            )}
          </div>
        ) : pendingSyncCount > 0 ? (
          <button
            onClick={syncPendingChanges}
            disabled={isSyncing}
            className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-lg shadow-lg border border-primary/20 hover:bg-primary/20 transition-colors"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span className="text-sm font-medium">Syncing...</span>
              </>
            ) : (
              <>
                <CloudOff className="h-4 w-4" />
                <span className="text-sm font-medium">{pendingSyncCount} pending changes</span>
                <span className="text-xs text-primary">Click to sync</span>
              </>
            )}
          </button>
        ) : null}
      </div>

      {/* Conflict Resolution Modal */}
      <SyncConflictModal
        isOpen={showConflictModal}
        onClose={() => setShowConflictModal(false)}
        onResolved={() => {
          toast({
            title: 'Conflicts Resolved',
            description: 'All sync conflicts have been resolved successfully.',
            variant: 'success',
          });
        }}
      />
    </>
  );
}

export function OfflineBadge() {
  const { isOnline, pendingSyncCount } = useOfflineStatus();

  if (isOnline && pendingSyncCount === 0) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        !isOnline ? 'bg-amber-100 text-amber-800' : 'bg-primary/10 text-primary'
      }`}
    >
      {!isOnline ? (
        <>
          <WifiOff className="h-3 w-3" />
          Offline
        </>
      ) : pendingSyncCount > 0 ? (
        <>
          <CloudOff className="h-3 w-3" />
          {pendingSyncCount} pending
        </>
      ) : null}
    </span>
  );
}

export function SyncStatusBadge({
  status,
}: {
  status: 'synced' | 'pending' | 'error' | 'conflict';
}) {
  if (status === 'synced') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-600">
        <Check className="h-3 w-3" />
        Synced
      </span>
    );
  }

  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-600">
        <CloudOff className="h-3 w-3" />
        Pending sync
      </span>
    );
  }

  if (status === 'conflict') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
        <AlertTriangle className="h-3 w-3" />
        Sync conflict
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-red-600">
      <CloudOff className="h-3 w-3" />
      Sync error
    </span>
  );
}

import { useState, useCallback } from 'react';
import { useOfflineStatus } from '@/lib/useOfflineStatus';
import { WifiOff, RefreshCw, CloudOff, Check, AlertTriangle } from 'lucide-react';
import { SyncConflictModal } from './SyncConflictModal';
import { toast } from '@/components/ui/toaster';

export function OfflineIndicator() {
  const [showConflictModal, setShowConflictModal] = useState(false);

  // Callback when conflict is detected during sync
  const handleConflictDetected = useCallback((_lotId: string, lotNumber: string, message: string) => {
    toast({
      title: `Sync Conflict: ${lotNumber}`,
      description: message,
      variant: 'warning',
      duration: 10000
    });
    // Open conflict modal after a short delay
    setTimeout(() => setShowConflictModal(true), 500);
  }, []);

  // Callback when sync completes successfully
  const handleSyncComplete = useCallback((syncedCount: number) => {
    toast({
      title: 'Sync Complete',
      description: `Successfully synced ${syncedCount} change${syncedCount > 1 ? 's' : ''}.`,
      variant: 'success',
      duration: 5000
    });
  }, []);

  const { isOnline, pendingSyncCount, isSyncing, syncPendingChanges, conflictCount } = useOfflineStatus({
    onConflictDetected: handleConflictDetected,
    onSyncComplete: handleSyncComplete
  });

  // Don't show when online, synced, and no conflicts
  if (isOnline && pendingSyncCount === 0 && conflictCount === 0) {
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
            className="flex items-center gap-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-lg shadow-lg border border-blue-200 hover:bg-blue-200 transition-colors"
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
                <span className="text-xs text-blue-600">Click to sync</span>
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
            variant: 'success'
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
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
      !isOnline ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
    }`}>
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

export function SyncStatusBadge({ status }: { status: 'synced' | 'pending' | 'error' | 'conflict' }) {
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

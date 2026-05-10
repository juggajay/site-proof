import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  getConflictedLots,
  resolveConflictWithLocal,
  resolveConflictWithServer,
  resolveConflictWithMerge,
  OfflineLotEdit,
} from '@/lib/offlineDb';
import { logError } from '@/lib/logger';

interface SyncConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResolved?: () => void;
}

function pickConflictForReview(
  conflicts: OfflineLotEdit[],
  preferredConflictId?: string,
): OfflineLotEdit | null {
  return (
    (preferredConflictId
      ? conflicts.find((conflict) => conflict.id === preferredConflictId)
      : undefined) ??
    conflicts[0] ??
    null
  );
}

function getMergeInputValue(value: OfflineLotEdit[keyof OfflineLotEdit] | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function formatConflictValue(value: OfflineLotEdit[keyof OfflineLotEdit] | undefined): string {
  const formatted = getMergeInputValue(value);
  return formatted === '' ? '-' : formatted;
}

const numericMergeFields = new Set<keyof OfflineLotEdit>([
  'chainage',
  'chainageStart',
  'chainageEnd',
  'offset',
  'offsetLeft',
  'offsetRight',
  'budget',
]);

function normalizeMergedFieldValue(
  field: keyof OfflineLotEdit,
  value: OfflineLotEdit[keyof OfflineLotEdit] | string | undefined,
): OfflineLotEdit[keyof OfflineLotEdit] | undefined {
  if (!numericMergeFields.has(field) || typeof value !== 'string') {
    return value === '' ? undefined : value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : value;
}

export function SyncConflictModal({ isOpen, onClose, onResolved }: SyncConflictModalProps) {
  const [conflicts, setConflicts] = useState<OfflineLotEdit[]>([]);
  const [selectedConflict, setSelectedConflict] = useState<OfflineLotEdit | null>(null);
  const [resolving, setResolving] = useState(false);
  const [showMergeView, setShowMergeView] = useState(false);
  const [mergedData, setMergedData] = useState<Partial<OfflineLotEdit>>({});

  const loadConflicts = useCallback(async () => {
    const conflictedLots = await getConflictedLots();
    const nextConflict = pickConflictForReview(conflictedLots, selectedConflict?.id);
    setConflicts(conflictedLots);
    setSelectedConflict(nextConflict);
    setMergedData(nextConflict ?? {});
    if (!nextConflict) {
      setShowMergeView(false);
    }
    return conflictedLots;
  }, [selectedConflict?.id]);

  // Load conflicts when modal opens
  useEffect(() => {
    if (isOpen) {
      loadConflicts();
    }
  }, [isOpen, loadConflicts]);

  const handleSelectConflict = (conflict: OfflineLotEdit) => {
    setSelectedConflict(conflict);
    setMergedData(conflict);
    setShowMergeView(false);
  };

  const handleResolveWithLocal = async () => {
    if (!selectedConflict) return;
    setResolving(true);
    try {
      await resolveConflictWithLocal(selectedConflict.id);
      const remainingConflicts = await loadConflicts();
      if (remainingConflicts.length === 0) {
        onResolved?.();
        onClose();
      }
    } catch (error) {
      logError('Failed to resolve conflict with local:', error);
    } finally {
      setResolving(false);
    }
  };

  const handleResolveWithServer = async () => {
    if (!selectedConflict) return;
    setResolving(true);
    try {
      await resolveConflictWithServer(selectedConflict.id);
      const remainingConflicts = await loadConflicts();
      if (remainingConflicts.length === 0) {
        onResolved?.();
        onClose();
      }
    } catch (error) {
      logError('Failed to resolve conflict with server:', error);
    } finally {
      setResolving(false);
    }
  };

  const handleResolveWithMerge = async () => {
    if (!selectedConflict) return;
    setResolving(true);
    try {
      await resolveConflictWithMerge(selectedConflict.id, mergedData);
      const remainingConflicts = await loadConflicts();
      if (remainingConflicts.length === 0) {
        onResolved?.();
        onClose();
      } else {
        setShowMergeView(false);
      }
    } catch (error) {
      logError('Failed to resolve conflict with merge:', error);
    } finally {
      setResolving(false);
    }
  };

  const handleMergedFieldChange = (
    field: keyof OfflineLotEdit,
    value: OfflineLotEdit[keyof OfflineLotEdit] | string | undefined,
  ) => {
    setMergedData((prev) => ({ ...prev, [field]: normalizeMergedFieldValue(field, value) }));
  };

  if (!isOpen) return null;

  const localVersion = selectedConflict;
  const serverVersion = selectedConflict?.conflictData?.serverVersion;

  // Fields to compare
  const compareFields: { key: keyof OfflineLotEdit; label: string }[] = [
    { key: 'lotNumber', label: 'Lot Number' },
    { key: 'description', label: 'Description' },
    { key: 'chainage', label: 'Chainage' },
    { key: 'layer', label: 'Layer' },
    { key: 'areaZone', label: 'Area/Zone' },
    { key: 'activityType', label: 'Activity Type' },
    { key: 'status', label: 'Status' },
    { key: 'notes', label: 'Notes' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-amber-50 dark:bg-amber-950/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-amber-600 dark:text-amber-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Sync Conflicts Detected</h2>
              <p className="text-sm text-muted-foreground">
                {conflicts.length} lot(s) have changes that conflict with server data
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Conflict List Sidebar */}
          {conflicts.length > 1 && (
            <div className="w-64 border-r border-border overflow-y-auto bg-muted/50">
              <div className="p-3">
                <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">
                  Conflicting Lots
                </h3>
                <div className="space-y-1">
                  {conflicts.map((conflict) => (
                    <button
                      key={conflict.id}
                      onClick={() => handleSelectConflict(conflict)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedConflict?.id === conflict.id
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      <div className="font-medium">{conflict.lotNumber}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {conflict.description || 'No description'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {selectedConflict ? (
              <>
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-foreground mb-1">
                    {selectedConflict.lotNumber}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    This lot was edited while you were offline, and someone else also made changes.
                  </p>
                </div>

                {showMergeView ? (
                  /* Merge View */
                  <div className="space-y-4">
                    <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4 mb-4">
                      <h4 className="font-medium text-purple-800 dark:text-purple-200 mb-2">
                        Manual Merge
                      </h4>
                      <p className="text-sm text-purple-700 dark:text-purple-300">
                        Choose the value you want for each field, or enter a custom value.
                      </p>
                    </div>

                    {compareFields.map(({ key, label }) => {
                      const localVal = localVersion?.[key];
                      const serverVal = serverVersion?.[key];
                      const isDifferent = localVal !== serverVal;

                      return (
                        <div
                          key={key}
                          className={`border rounded-lg p-4 ${isDifferent ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20' : 'border-border'}`}
                        >
                          <label className="block text-sm font-medium text-foreground mb-2">
                            {label}
                            {isDifferent && (
                              <span className="ml-2 text-amber-600 dark:text-amber-400 text-xs">
                                (differs)
                              </span>
                            )}
                          </label>
                          <div className="grid grid-cols-3 gap-2 mb-2 text-sm">
                            <div>
                              <span className="text-xs text-muted-foreground">Your version:</span>
                              <button
                                type="button"
                                onClick={() => handleMergedFieldChange(key, localVal)}
                                className="w-full text-left px-2 py-1 rounded border hover:bg-primary/5 hover:border-primary truncate"
                              >
                                {formatConflictValue(localVal)}
                              </button>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Server version:</span>
                              <button
                                type="button"
                                onClick={() => handleMergedFieldChange(key, serverVal)}
                                className="w-full text-left px-2 py-1 rounded border hover:bg-green-50 dark:hover:bg-green-950/30 hover:border-green-300 dark:hover:border-green-700 truncate"
                              >
                                {formatConflictValue(serverVal)}
                              </button>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Merged value:</span>
                              <input
                                type="text"
                                value={getMergeInputValue(mergedData[key])}
                                onChange={(e) => handleMergedFieldChange(key, e.target.value)}
                                className="w-full px-2 py-1 rounded border border-purple-300 dark:border-purple-700 bg-background text-foreground text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Comparison View */
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                            Field
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-primary uppercase">
                            Your Changes
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-green-600 dark:text-green-400 uppercase">
                            Server Version
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {compareFields.map(({ key, label }) => {
                          const localVal = localVersion?.[key];
                          const serverVal = serverVersion?.[key];
                          const isDifferent = localVal !== serverVal;

                          return (
                            <tr
                              key={key}
                              className={isDifferent ? 'bg-amber-50 dark:bg-amber-950/20' : ''}
                            >
                              <td className="px-4 py-2 font-medium text-foreground">
                                {label}
                                {isDifferent && (
                                  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200">
                                    Changed
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-primary">
                                {formatConflictValue(localVal)}
                              </td>
                              <td className="px-4 py-2 text-green-800 dark:text-green-300">
                                {formatConflictValue(serverVal)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Timestamps */}
                <div className="mt-4 grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                  <div>
                    <span className="font-medium">Your edit:</span>{' '}
                    {new Date(localVersion?.localUpdatedAt || '').toLocaleString()}
                  </div>
                  <div>
                    <span className="font-medium">Server update:</span>{' '}
                    {selectedConflict.conflictData?.detectedAt
                      ? new Date(selectedConflict.conflictData.detectedAt).toLocaleString()
                      : '—'}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                {conflicts.length === 0
                  ? 'No conflicts to resolve!'
                  : 'Select a conflict from the list to review'}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        {selectedConflict && (
          <div className="px-6 py-4 border-t border-border bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                How do you want to resolve this conflict?
              </div>
              <div className="flex gap-3">
                {showMergeView ? (
                  <>
                    <Button variant="outline" onClick={() => setShowMergeView(false)}>
                      Back to Compare
                    </Button>
                    <Button
                      className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 text-white"
                      onClick={handleResolveWithMerge}
                      disabled={resolving}
                    >
                      {resolving ? 'Saving...' : 'Save Merged Version'}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" onClick={onClose}>
                      Decide Later
                    </Button>
                    <Button
                      variant="success"
                      onClick={handleResolveWithServer}
                      disabled={resolving}
                    >
                      {resolving ? 'Applying...' : 'Use Server Version'}
                    </Button>
                    <Button onClick={handleResolveWithLocal} disabled={resolving}>
                      {resolving ? 'Applying...' : 'Keep My Changes'}
                    </Button>
                    <Button
                      variant="outline"
                      className="text-purple-700 dark:text-purple-200 bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/50 border-purple-200 dark:border-purple-800"
                      onClick={() => setShowMergeView(true)}
                    >
                      Merge Manually
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

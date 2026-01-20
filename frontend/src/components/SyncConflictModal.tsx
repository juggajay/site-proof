import { useState, useEffect } from 'react';
import {
  getConflictedLots,
  resolveConflictWithLocal,
  resolveConflictWithServer,
  resolveConflictWithMerge,
  OfflineLotEdit
} from '@/lib/offlineDb';

interface SyncConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResolved?: () => void;
}

export function SyncConflictModal({ isOpen, onClose, onResolved }: SyncConflictModalProps) {
  const [conflicts, setConflicts] = useState<OfflineLotEdit[]>([]);
  const [selectedConflict, setSelectedConflict] = useState<OfflineLotEdit | null>(null);
  const [resolving, setResolving] = useState(false);
  const [showMergeView, setShowMergeView] = useState(false);
  const [mergedData, setMergedData] = useState<Partial<OfflineLotEdit>>({});

  // Load conflicts when modal opens
  useEffect(() => {
    if (isOpen) {
      loadConflicts();
    }
  }, [isOpen]);

  const loadConflicts = async () => {
    const conflictedLots = await getConflictedLots();
    setConflicts(conflictedLots);
    if (conflictedLots.length > 0 && !selectedConflict) {
      setSelectedConflict(conflictedLots[0]);
      // Initialize merged data with local values
      setMergedData(conflictedLots[0]);
    }
  };

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
      await loadConflicts();
      if (conflicts.length <= 1) {
        onResolved?.();
        onClose();
      } else {
        setSelectedConflict(null);
      }
    } catch (error) {
      console.error('Failed to resolve conflict with local:', error);
    } finally {
      setResolving(false);
    }
  };

  const handleResolveWithServer = async () => {
    if (!selectedConflict) return;
    setResolving(true);
    try {
      await resolveConflictWithServer(selectedConflict.id);
      await loadConflicts();
      if (conflicts.length <= 1) {
        onResolved?.();
        onClose();
      } else {
        setSelectedConflict(null);
      }
    } catch (error) {
      console.error('Failed to resolve conflict with server:', error);
    } finally {
      setResolving(false);
    }
  };

  const handleResolveWithMerge = async () => {
    if (!selectedConflict) return;
    setResolving(true);
    try {
      await resolveConflictWithMerge(selectedConflict.id, mergedData);
      await loadConflicts();
      if (conflicts.length <= 1) {
        onResolved?.();
        onClose();
      } else {
        setSelectedConflict(null);
        setShowMergeView(false);
      }
    } catch (error) {
      console.error('Failed to resolve conflict with merge:', error);
    } finally {
      setResolving(false);
    }
  };

  const handleMergedFieldChange = (field: keyof OfflineLotEdit, value: any) => {
    setMergedData(prev => ({ ...prev, [field]: value }));
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
    { key: 'notes', label: 'Notes' }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-amber-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Sync Conflicts Detected</h2>
              <p className="text-sm text-gray-600">
                {conflicts.length} lot(s) have changes that conflict with server data
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Conflict List Sidebar */}
          {conflicts.length > 1 && (
            <div className="w-64 border-r border-gray-200 overflow-y-auto bg-gray-50">
              <div className="p-3">
                <h3 className="text-xs font-medium text-gray-500 uppercase mb-2">Conflicting Lots</h3>
                <div className="space-y-1">
                  {conflicts.map(conflict => (
                    <button
                      key={conflict.id}
                      onClick={() => handleSelectConflict(conflict)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedConflict?.id === conflict.id
                          ? 'bg-blue-100 text-blue-800 font-medium'
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <div className="font-medium">{conflict.lotNumber}</div>
                      <div className="text-xs text-gray-500 truncate">
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
                  <h3 className="text-lg font-medium text-gray-900 mb-1">
                    {selectedConflict.lotNumber}
                  </h3>
                  <p className="text-sm text-gray-500">
                    This lot was edited while you were offline, and someone else also made changes.
                  </p>
                </div>

                {showMergeView ? (
                  /* Merge View */
                  <div className="space-y-4">
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                      <h4 className="font-medium text-purple-800 mb-2">Manual Merge</h4>
                      <p className="text-sm text-purple-700">
                        Choose the value you want for each field, or enter a custom value.
                      </p>
                    </div>

                    {compareFields.map(({ key, label }) => {
                      const localVal = localVersion?.[key];
                      const serverVal = serverVersion?.[key];
                      const isDifferent = localVal !== serverVal;

                      return (
                        <div key={key} className={`border rounded-lg p-4 ${isDifferent ? 'border-amber-300 bg-amber-50' : 'border-gray-200'}`}>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {label}
                            {isDifferent && <span className="ml-2 text-amber-600 text-xs">(differs)</span>}
                          </label>
                          <div className="grid grid-cols-3 gap-2 mb-2 text-sm">
                            <div>
                              <span className="text-xs text-gray-500">Your version:</span>
                              <button
                                type="button"
                                onClick={() => handleMergedFieldChange(key, localVal)}
                                className="w-full text-left px-2 py-1 rounded border hover:bg-blue-50 hover:border-blue-300 truncate"
                              >
                                {String(localVal || '—')}
                              </button>
                            </div>
                            <div>
                              <span className="text-xs text-gray-500">Server version:</span>
                              <button
                                type="button"
                                onClick={() => handleMergedFieldChange(key, serverVal)}
                                className="w-full text-left px-2 py-1 rounded border hover:bg-green-50 hover:border-green-300 truncate"
                              >
                                {String(serverVal || '—')}
                              </button>
                            </div>
                            <div>
                              <span className="text-xs text-gray-500">Merged value:</span>
                              <input
                                type="text"
                                value={String(mergedData[key] || '')}
                                onChange={(e) => handleMergedFieldChange(key, e.target.value)}
                                className="w-full px-2 py-1 rounded border border-purple-300 bg-white text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Comparison View */
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Field</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-blue-600 uppercase">Your Changes</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-green-600 uppercase">Server Version</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {compareFields.map(({ key, label }) => {
                          const localVal = localVersion?.[key];
                          const serverVal = serverVersion?.[key];
                          const isDifferent = localVal !== serverVal;

                          return (
                            <tr key={key} className={isDifferent ? 'bg-amber-50' : ''}>
                              <td className="px-4 py-2 font-medium text-gray-700">
                                {label}
                                {isDifferent && (
                                  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                                    Changed
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-blue-800">
                                {String(localVal || '—')}
                              </td>
                              <td className="px-4 py-2 text-green-800">
                                {String(serverVal || '—')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Timestamps */}
                <div className="mt-4 grid grid-cols-2 gap-4 text-xs text-gray-500">
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
              <div className="text-center py-12 text-gray-500">
                {conflicts.length === 0
                  ? 'No conflicts to resolve!'
                  : 'Select a conflict from the list to review'}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        {selectedConflict && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                How do you want to resolve this conflict?
              </div>
              <div className="flex gap-3">
                {showMergeView ? (
                  <>
                    <button
                      onClick={() => setShowMergeView(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Back to Compare
                    </button>
                    <button
                      onClick={handleResolveWithMerge}
                      disabled={resolving}
                      className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50"
                    >
                      {resolving ? 'Saving...' : 'Save Merged Version'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={onClose}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Decide Later
                    </button>
                    <button
                      onClick={handleResolveWithServer}
                      disabled={resolving}
                      className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                      {resolving ? 'Applying...' : 'Use Server Version'}
                    </button>
                    <button
                      onClick={handleResolveWithLocal}
                      disabled={resolving}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {resolving ? 'Applying...' : 'Keep My Changes'}
                    </button>
                    <button
                      onClick={() => setShowMergeView(true)}
                      className="px-4 py-2 text-sm font-medium text-purple-700 bg-purple-100 rounded-md hover:bg-purple-200"
                    >
                      Merge Manually
                    </button>
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

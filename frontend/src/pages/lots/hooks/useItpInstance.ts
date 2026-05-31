/**
 * ITP instance data hook, extracted verbatim from LotDetailPage.tsx.
 *
 * Owns the ITP instance fetch, the offline write-through / cache-fallback, the
 * 20s hold-point-release polling, and template assignment. Mutation handlers
 * (toggle/notes/NA/failed/photos) remain in the page for now and consume the
 * raw `setItpInstance` / `setOfflinePendingCount` setters this hook exposes —
 * those move into the hook in a later slice (PR-C/PR-D).
 *
 * Behavior is intentionally unchanged: same API paths, same offline-cache
 * decision tree, same "Offline Mode" toast, same polling semantics. The page
 * passes `refetchReadiness` / `refetchConformStatus` (page-owned queries) which
 * are refreshed after a successful assignment.
 */
import { useCallback, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { devLog, logError } from '@/lib/logger';
import { extractErrorMessage } from '@/lib/errorHandling';
import { toast } from '@/components/ui/toaster';
import { cacheITPChecklist, getCachedITPChecklist, getPendingSyncCount } from '@/lib/offlineDb';
import type { ITPCompletion, ITPInstance, ITPTemplate, LotTab } from '../types';
import { mapCachedToItpInstance, mapInstanceToOfflineItems } from '../lib/itpOfflineMapping';

interface UseItpInstanceParams {
  projectId: string | undefined;
  lotId: string | undefined;
  currentTab: LotTab;
  /** From useOfflineStatus(); re-triggers the fetch when connectivity flips. */
  isOnline: boolean;
  /** Page-owned readiness query refetch, run after a successful assignment. */
  refetchReadiness: () => void;
  /** Page-owned conform-status fetch, run after a successful assignment. */
  refetchConformStatus: () => void;
}

export function useItpInstance({
  projectId,
  lotId,
  currentTab,
  isOnline,
  refetchReadiness,
  refetchConformStatus,
}: UseItpInstanceParams) {
  const [itpInstance, setItpInstance] = useState<ITPInstance | null>(null);
  const [loadingItp, setLoadingItp] = useState(false);
  const [itpLoadError, setItpLoadError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ITPTemplate[]>([]);
  const [isOfflineData, setIsOfflineData] = useState(false);
  const [offlinePendingCount, setOfflinePendingCount] = useState(0);
  const [assigningTemplate, setAssigningTemplate] = useState(false);

  const fetchItpInstance = useCallback(async () => {
    if (!projectId || !lotId || currentTab !== 'itp') return;

    setLoadingItp(true);
    setItpLoadError(null);
    setIsOfflineData(false);

    const encodedProjectId = encodeURIComponent(projectId);
    const encodedLotId = encodeURIComponent(lotId);

    // Check offline pending count
    const pendingCount = await getPendingSyncCount();
    setOfflinePendingCount(pendingCount);

    const loadAvailableTemplates = async () => {
      setItpInstance(null);
      try {
        const templatesData = await apiFetch<{ templates: ITPTemplate[] }>(
          `/api/itp/templates?projectId=${encodedProjectId}&includeGlobal=true`,
        );
        setTemplates(templatesData.templates || []);
      } catch (templateErr) {
        logError('Failed to fetch ITP templates for lot:', templateErr);
        setTemplates([]);
        setItpLoadError(
          extractErrorMessage(
            templateErr,
            'No ITP is assigned, and available templates could not be loaded.',
          ),
        );
      }
    };

    try {
      // Try to fetch from server first
      const data = await apiFetch<{ instance: ITPInstance | null }>(
        `/api/itp/instances/lot/${encodedLotId}`,
      );
      if (!data.instance) {
        await loadAvailableTemplates();
        return;
      }

      const instance = data.instance;
      setItpInstance(instance);
      setIsOfflineData(false);

      // Cache the ITP data for offline use
      if (instance.template) {
        const items = mapInstanceToOfflineItems(instance);
        await cacheITPChecklist(lotId, instance.template.id, instance.template.name, items);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // Backwards-compatible handling for older deployments that still used 404 for no ITP.
        await loadAvailableTemplates();
      } else {
        logError('Failed to fetch ITP instance, trying offline cache:', err);

        // Try to load from offline cache
        const cachedData = await getCachedITPChecklist(lotId);
        if (cachedData) {
          // Convert cached data to ITPInstance format
          const offlineInstance = mapCachedToItpInstance(cachedData);
          setItpInstance(offlineInstance);
          setIsOfflineData(true);
          toast({
            title: 'Offline Mode',
            description: `Showing cached data from ${new Date(cachedData.cachedAt).toLocaleDateString('en-AU')}`,
            variant: 'default',
          });
        } else {
          setItpInstance(null);
          setItpLoadError(extractErrorMessage(err, 'Failed to load ITP checklist.'));
        }
      }
    } finally {
      setLoadingItp(false);
    }
  }, [projectId, lotId, currentTab]);

  // Fetch ITP instance when ITP tab is selected (with offline support)
  useEffect(() => {
    void fetchItpInstance();
  }, [fetchItpInstance, isOnline]);

  // Feature #734: Real-time HP release notification polling
  // Poll for ITP updates every 20 seconds to catch holdpoint releases quickly
  useEffect(() => {
    if (!lotId || currentTab !== 'itp' || !isOnline) return;

    let pollInterval: NodeJS.Timeout | null = null;

    const silentFetchItpUpdates = async () => {
      try {
        const data = await apiFetch<{ instance: ITPInstance | null }>(
          `/api/itp/instances/lot/${encodeURIComponent(lotId)}`,
        );
        // Only update if there are actual changes in completions
        setItpInstance((prevInstance) => {
          if (!data.instance) return null;
          if (!prevInstance) return data.instance;

          const prevCompletions = prevInstance.completions || [];
          const newCompletions = data.instance.completions || [];

          // Check if completions have changed
          const hasChanges =
            newCompletions.length !== prevCompletions.length ||
            newCompletions.some((newComp: ITPCompletion) => {
              const prevComp = prevCompletions.find(
                (p) => p.checklistItemId === newComp.checklistItemId,
              );
              return (
                !prevComp ||
                prevComp.isCompleted !== newComp.isCompleted ||
                prevComp.isVerified !== newComp.isVerified ||
                prevComp.completedAt !== newComp.completedAt
              );
            });

          return hasChanges ? data.instance : prevInstance;
        });
      } catch (err) {
        // Silent fail for background polling
        devLog('Background ITP fetch failed:', err);
      }
    };

    const startPolling = () => {
      // Poll every 20 seconds for ITP (more frequent for HP releases)
      pollInterval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          silentFetchItpUpdates();
        }
      }, 20000);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        silentFetchItpUpdates();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [lotId, currentTab, isOnline]);

  const assignTemplate = async (templateId: string) => {
    if (!lotId || assigningTemplate) return false;

    setAssigningTemplate(true);
    setItpLoadError(null);

    try {
      const data = await apiFetch<{ instance: ITPInstance }>('/api/itp/instances', {
        method: 'POST',
        body: JSON.stringify({ lotId, templateId }),
      });
      setItpInstance(data.instance);
      void refetchReadiness();
      void refetchConformStatus();
      // Modal closing is handled by the ITPChecklistTab component
      return true;
    } catch (err) {
      logError('Failed to assign template:', err);
      toast({
        title: 'Failed to assign ITP template',
        description: extractErrorMessage(err, 'Please try again.'),
        variant: 'error',
      });
      return false;
    } finally {
      setAssigningTemplate(false);
    }
  };

  return {
    itpInstance,
    setItpInstance,
    loadingItp,
    itpLoadError,
    templates,
    isOfflineData,
    offlinePendingCount,
    setOfflinePendingCount,
    assigningTemplate,
    refetchItp: fetchItpInstance,
    assignTemplate,
  };
}

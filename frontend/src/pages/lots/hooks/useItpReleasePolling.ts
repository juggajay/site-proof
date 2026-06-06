import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { apiFetch } from '@/lib/api';
import { devLog } from '@/lib/logger';
import type { ITPCompletion, ITPInstance, LotTab } from '../types';

interface UseItpReleasePollingParams {
  lotId: string | undefined;
  currentTab: LotTab;
  isOnline: boolean;
  setItpInstance: Dispatch<SetStateAction<ITPInstance | null>>;
}

function hasCompletionChanges(
  previousCompletions: ITPCompletion[],
  nextCompletions: ITPCompletion[],
): boolean {
  return (
    nextCompletions.length !== previousCompletions.length ||
    nextCompletions.some((newCompletion) => {
      const previousCompletion = previousCompletions.find(
        (completion) => completion.checklistItemId === newCompletion.checklistItemId,
      );
      return (
        !previousCompletion ||
        previousCompletion.isCompleted !== newCompletion.isCompleted ||
        previousCompletion.isVerified !== newCompletion.isVerified ||
        previousCompletion.completedAt !== newCompletion.completedAt
      );
    })
  );
}

export function useItpReleasePolling({
  lotId,
  currentTab,
  isOnline,
  setItpInstance,
}: UseItpReleasePollingParams) {
  useEffect(() => {
    if (!lotId || currentTab !== 'itp' || !isOnline) return;

    let pollInterval: NodeJS.Timeout | null = null;

    const silentFetchItpUpdates = async () => {
      try {
        const data = await apiFetch<{ instance: ITPInstance | null }>(
          `/api/itp/instances/lot/${encodeURIComponent(lotId)}`,
        );
        // Only update if there are actual changes in completions.
        setItpInstance((previousInstance) => {
          if (!data.instance) return null;
          if (!previousInstance) return data.instance;

          const previousCompletions = previousInstance.completions || [];
          const nextCompletions = data.instance.completions || [];

          return hasCompletionChanges(previousCompletions, nextCompletions)
            ? data.instance
            : previousInstance;
        });
      } catch (err) {
        // Silent fail for background polling.
        devLog('Background ITP fetch failed:', err);
      }
    };

    const startPolling = () => {
      // Poll every 20 seconds for ITP (more frequent for HP releases).
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
  }, [lotId, currentTab, isOnline, setItpInstance]);
}

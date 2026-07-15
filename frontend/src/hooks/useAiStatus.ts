import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Whether AI extraction (setout-sheet import, certificate reading) is configured
 * on this server. Used to disable AI-only actions when there is no Anthropic key,
 * instead of letting the user pick a file and then hit a 503.
 *
 * Defaults to configured while loading so the button doesn't flicker disabled in
 * the common (configured) case, and never changes within a session — so it's
 * cached indefinitely.
 */
export function useAiStatus() {
  const query = useQuery({
    queryKey: queryKeys.aiStatus,
    queryFn: () => apiFetch<{ aiConfigured: boolean }>('/api/ai/status'),
    staleTime: Infinity,
    cacheTime: Infinity,
  });

  return { aiConfigured: query.data?.aiConfigured ?? true };
}

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { ITPInstance } from '@/pages/lots/types';

export interface LotItpTestItem {
  id: string;
  description: string;
  testType: string | null;
}

// A checklist item requires a test when its evidence gate is 'test' OR it names a
// specific testType (some templates set testType without flipping evidenceRequired).
const isTestRequired = (item: ITPInstance['template']['checklistItems'][number]): boolean =>
  item.evidenceRequired === 'test' || Boolean(item.testType);

/**
 * The lot's ITP checklist items that require a test, for the "which requirement
 * does this test satisfy?" pickers in the test-results UI. Returns [] when the
 * lot has no assigned ITP instance.
 */
export function useLotItpTestItems(lotId: string | null | undefined) {
  const query = useQuery({
    queryKey: queryKeys.itpInstanceByLot(lotId ?? ''),
    enabled: Boolean(lotId),
    queryFn: () =>
      apiFetch<{ instance: ITPInstance | null }>(
        '/api/itp/instances/lot/' + encodeURIComponent(lotId!),
      ),
  });

  const items: LotItpTestItem[] = (query.data?.instance?.template.checklistItems ?? [])
    .filter(isTestRequired)
    .map((item) => ({
      id: item.id,
      description: item.description,
      testType: item.testType ?? null,
    }));

  return { items, isLoading: query.isLoading };
}

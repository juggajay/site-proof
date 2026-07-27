import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { resolveProjectRuleset, useSufficiencyRulesets } from '@/lib/testSufficiency';

/**
 * Wave C1 (§9.4): the test-sufficiency surfaces only appear where a shipped
 * frequency ruleset governs the project. Both reads share caches that other
 * surfaces already populate — `queryKeys.project` caches the UNWRAPPED project,
 * so every consumer must resolve the same shape or they poison each other's
 * cache.
 *
 * C1 (F14): a failed fetch is not "this project has no pack". Silently dropping
 * the affordance reads as an authoritative "not supported here", so callers get
 * `rulesetLoadFailed` + a retry instead.
 */
export function useGoverningRuleset(projectId: string | undefined) {
  const projectAuthorityQuery = useQuery({
    queryKey: queryKeys.project(projectId ?? 'none'),
    queryFn: () =>
      apiFetch<{ project?: { state?: string; specificationSet?: string } }>(
        `/api/projects/${projectId}`,
      ).then((response) => response.project ?? null),
    enabled: !!projectId,
  });
  const projectAuthority = projectAuthorityQuery.data;
  const rulesetsQuery = useSufficiencyRulesets();

  return {
    governingRuleset: resolveProjectRuleset(
      rulesetsQuery.data?.rulesets,
      projectAuthority?.state,
      projectAuthority?.specificationSet,
    ),
    rulesetLoadFailed: rulesetsQuery.isError || projectAuthorityQuery.isError,
    retryRulesetLoad: () => {
      void rulesetsQuery.refetch();
      void projectAuthorityQuery.refetch();
    },
  };
}

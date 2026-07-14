/**
 * LotMapScreen — /m/lots/map — the satellite lot map inside the foreman shell.
 *
 * Hosts the EXISTING LotMapView unchanged (colour-coded lot polygons on imagery,
 * plan-sheet overlays with paper-blend, coverage, find-by-area, time scrubber,
 * GPS locate). The shell only resolves its props from the shared lots context and
 * mounts it inside a ShellScreen; the heavy Leaflet chunk stays out of the shell's
 * base bundle via the same lazy import the classic register uses.
 *
 * Foreman-truth (doc 14): Draw lot is a settings capability — foremen get
 * canManageSettings=false (computed with the same helper the classic page uses),
 * so the map is read/inspect only for them.
 */
import { lazy, Suspense, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { canManageProjectSettings } from '@/lib/roles';
import { getProjectScopedRole } from '@/lib/subcontractorIdentity';
import { ShellScreen } from '../../components/ShellScreen';
import { useLotsShellContext } from './lotsShellContext';

// Lazy so Leaflet (map engine + tiles) never enters the shell's base bundle —
// same split the classic register uses (LotsPage.tsx).
const LotMapView = lazy(() =>
  import('@/pages/lots/map/LotMapView').then((m) => ({ default: m.LotMapView })),
);

export function LotMapScreen() {
  const { user } = useAuth();
  const { projectId, lots, loading, error } = useLotsShellContext();

  const canManageSettings = canManageProjectSettings(getProjectScopedRole(user));
  const filteredLotIds = useMemo(() => new Set(lots.map((lot) => lot.id)), [lots]);

  // Project NAME for the snapshot caption, from the same cached projects query the
  // home header uses (shared cache key — no extra fetch in practice). Optional in
  // LotMapView; falls back to the id when absent.
  const { data: projectsData } = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => apiFetch<{ projects: { id: string; name: string }[] }>('/api/projects'),
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });
  const projectName = projectsData?.projects?.find((p) => p.id === projectId)?.name;

  // No project resolved: the lots context disables its queries, so mirror the
  // list screen's benign empty state rather than mounting the map with no id.
  if (!projectId) {
    return (
      <ShellScreen variant="inner" title="Map" parent="/m/lots" sub={<span>No project</span>}>
        <div className="py-16 text-center text-[14px] leading-relaxed text-muted-foreground">
          No project selected.
          <br />
          Pick a project to see its lot map.
        </div>
      </ShellScreen>
    );
  }

  const sub = (
    <span>
      {lots.length} lot{lots.length === 1 ? '' : 's'}
    </span>
  );

  if (loading) {
    return (
      <ShellScreen variant="inner" title="Map" parent="/m/lots" sub={<span>Loading…</span>}>
        <div className="h-[60dvh] max-h-[520px] animate-pulse rounded-2xl bg-muted" />
      </ShellScreen>
    );
  }

  return (
    <ShellScreen variant="inner" title="Map" parent="/m/lots" sub={sub}>
      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] font-semibold text-destructive">
          Couldn’t load lots. Pull back and try again.
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border">
        <Suspense
          fallback={
            <div className="p-12 text-center text-[13px] text-muted-foreground" role="status">
              Loading map…
            </div>
          }
        >
          <LotMapView
            projectId={projectId}
            filteredLotIds={filteredLotIds}
            canManageSettings={canManageSettings}
            projectName={projectName}
            lots={lots}
          />
        </Suspense>
      </div>
    </ShellScreen>
  );
}

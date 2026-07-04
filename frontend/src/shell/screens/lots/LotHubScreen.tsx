/**
 * LotHubScreen — /m/lots/:lotId — the lot mini-hub for the foreman shell.
 *
 * Design spec: docs/design-foreman-shell-mock-v4.html #lot.
 * Tiles: Inspections (n of m done · X due), Photos (count), Drawings, Details.
 * Primary bottom action "Continue inspections — N due" (hidden when none due).
 *
 * Foreman-truth (doc 14): read + inspect only — NO edit affordances, no conform
 * button, no budget. The Details tile is read-only.
 *
 * Reuse: the Inspections summary comes from `useShellItpRun` (the same ITP
 * instance fetch + offline cache the run screen uses). Photos/Drawings counts
 * come from the lot register (`documentCount`) — the register has no
 * photo-vs-drawing split, so the Photos tile is honest about "documents on this
 * lot" and routes to the shell Photos surface. The Drawings tile routes to the
 * shell Drawings & Docs register (/m/docs) with lotId context so linked docs and
 * test certificates narrow to this lot, while project-wide drawings still appear.
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, Camera, Ruler, Info } from 'lucide-react';
import { ShellScreen } from '../../components/ShellScreen';
import { HubTile } from '../../components/HubTile';
import { useLotsShellContext } from './lotsShellContext';
import { useShellItpRun } from './useShellItpRun';
import { formatItpOutcomeSummary, itpHubSummary, lotStatusTone } from './lotsShellState';
import { formatStatusLabel } from '@/lib/statusLabels';
import { useShellLotParam } from './useShellLotParam';

export function LotHubScreen() {
  const navigate = useNavigate();
  const { projectId, lots, checksDue } = useLotsShellContext();
  const lotId = useShellLotParam();

  const lot = useMemo(() => lots.find((l) => l.id === lotId), [lots, lotId]);
  const due = lotId ? (checksDue[lotId] ?? 0) : 0;

  const run = useShellItpRun(projectId ?? undefined, lotId);
  const summary = useMemo(() => itpHubSummary(run.instance, due), [run.instance, due]);

  const withProject = (path: string, params: Record<string, string | undefined> = {}) => {
    const query = new URLSearchParams();
    if (projectId) query.set('projectId', projectId);
    Object.entries(params).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    const queryString = query.toString();
    return queryString ? `${path}?${queryString}` : path;
  };

  const lotNumber = lot?.lotNumber ?? 'Lot';
  const status = lot?.status ?? '';
  const tone = lotStatusTone(status);
  const documentCount = lot?.documentCount ?? 0;

  const inspectionsDesc = run.loading
    ? 'Loading checklist…'
    : summary.total === 0
      ? 'No ITP assigned yet'
      : `${formatItpOutcomeSummary(summary)}${due > 0 ? ` · ${due} due today` : ''}`;

  const sub = (
    <span className="flex items-center gap-2">
      {lot?.description ? <span>{lot.description}</span> : <span>Lot details</span>}
      {status && (
        <span
          className={
            tone === 'good'
              ? 'shell-mono text-[12px] font-semibold uppercase text-success'
              : tone === 'attention' || tone === 'bad'
                ? 'shell-mono text-[12px] font-semibold uppercase text-warning'
                : 'shell-mono text-[12px] font-semibold uppercase text-muted-foreground'
          }
        >
          {formatStatusLabel(status).toUpperCase()}
        </span>
      )}
    </span>
  );

  return (
    <ShellScreen
      variant="inner"
      title={lotNumber}
      parent="/m/lots"
      sub={sub}
      bottom={
        due > 0 ? (
          <div className="shell-primary">
            <button
              type="button"
              className="shell-primary-btn"
              onClick={() => navigate(withProject(`/m/lots/${lotId}/itp`))}
              aria-label={`Continue inspections — ${due} due`}
            >
              Continue inspections — {due} due
            </button>
          </div>
        ) : undefined
      }
    >
      <HubTile
        icon={ClipboardCheck}
        title="Inspections"
        chip={
          due > 0
            ? `${due} due`
            : summary.failed > 0
              ? `${summary.failed} failed`
              : summary.total > 0 && summary.accepted === summary.total
                ? 'Done'
                : undefined
        }
        chipOk={summary.total > 0 && summary.accepted === summary.total && summary.failed === 0}
        onPress={() => navigate(withProject(`/m/lots/${lotId}/itp`))}
        ariaLabel={`Inspections — ${inspectionsDesc}`}
      />

      <HubTile
        icon={Camera}
        title="Photos"
        chip={documentCount > 0 ? `${documentCount}` : undefined}
        onPress={() => navigate(withProject('/m/photos', { lotId }))}
        ariaLabel={`Photos${documentCount > 0 ? ` — ${documentCount} on this lot` : ''}`}
      />

      <HubTile
        icon={Ruler}
        title="Drawings"
        onPress={() => navigate(withProject('/m/docs', { lotId }))}
        ariaLabel="Drawings for this lot"
      />

      <HubTile
        icon={Info}
        title="Details & status"
        onPress={() => navigate(withProject(`/m/lots/${lotId}/details`))}
        ariaLabel="Lot details and status, read only"
      />
    </ShellScreen>
  );
}

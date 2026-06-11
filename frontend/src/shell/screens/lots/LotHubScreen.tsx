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
 * lot" and routes to a styled ComingSoon until the shell Photos surface ships.
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ClipboardCheck, Camera, Ruler, Info } from 'lucide-react';
import { ShellScreen } from '../../components/ShellScreen';
import { useLotsShellContext } from './lotsShellContext';
import { useShellItpRun } from './useShellItpRun';
import { itpHubSummary, lotStatusTone } from './lotsShellState';
import { formatStatusLabel } from '@/lib/statusLabels';
import { useShellLotParam } from './useShellLotParam';

function HubTile({
  icon: Icon,
  title,
  description,
  chip,
  chipOk,
  onPress,
  ariaLabel,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  chip?: string;
  chipOk?: boolean;
  onPress: () => void;
  ariaLabel: string;
}) {
  return (
    <button type="button" className="shell-hub" onClick={onPress} aria-label={ariaLabel}>
      <span className="shell-hub-ico" aria-hidden>
        <Icon size={22} strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="shell-tile-title block">{title}</span>
        <span className="mt-[1px] block text-[13px] text-muted-foreground">{description}</span>
      </span>
      {chip !== undefined && (
        <span
          className={chipOk ? 'shell-count-chip shell-count-chip-ok' : 'shell-count-chip'}
          aria-hidden
        >
          {chip}
        </span>
      )}
      <ChevronRight size={18} className="flex-shrink-0 text-muted-foreground/50" aria-hidden />
    </button>
  );
}

export function LotHubScreen() {
  const navigate = useNavigate();
  const { projectId, lots, checksDue } = useLotsShellContext();
  const lotId = useShellLotParam();

  const lot = useMemo(() => lots.find((l) => l.id === lotId), [lots, lotId]);
  const due = lotId ? (checksDue[lotId] ?? 0) : 0;

  const run = useShellItpRun(projectId ?? undefined, lotId);
  const summary = useMemo(() => itpHubSummary(run.instance, due), [run.instance, due]);

  const withProject = (path: string) => (projectId ? `${path}?projectId=${projectId}` : path);

  const lotNumber = lot?.lotNumber ?? 'Lot';
  const status = lot?.status ?? '';
  const tone = lotStatusTone(status);
  const documentCount = lot?.documentCount ?? 0;

  const inspectionsDesc = run.loading
    ? 'Loading checklist…'
    : summary.total === 0
      ? 'No ITP assigned yet'
      : `${summary.resolved} of ${summary.total} done${due > 0 ? ` · ${due} due today` : ''}`;

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
        description={inspectionsDesc}
        chip={
          due > 0
            ? `${due} due`
            : summary.total > 0 && summary.resolved === summary.total
              ? 'Done'
              : undefined
        }
        chipOk={summary.total > 0 && summary.resolved === summary.total}
        onPress={() => navigate(withProject(`/m/lots/${lotId}/itp`))}
        ariaLabel={`Inspections — ${inspectionsDesc}`}
      />

      <HubTile
        icon={Camera}
        title="Photos"
        description={documentCount > 0 ? `${documentCount} on this lot` : 'No documents yet'}
        onPress={() => navigate(withProject('/m/photos'))}
        ariaLabel={`Photos${documentCount > 0 ? ` — ${documentCount} on this lot` : ''}`}
      />

      <HubTile
        icon={Ruler}
        title="Drawings"
        description="Current revisions for this lot"
        onPress={() => navigate(withProject('/m/docs'))}
        ariaLabel="Drawings for this lot"
      />

      <HubTile
        icon={Info}
        title="Details & status"
        description="Read-only — conformance is the office’s call"
        onPress={() => navigate(withProject(`/m/lots/${lotId}/details`))}
        ariaLabel="Lot details and status, read only"
      />
    </ShellScreen>
  );
}

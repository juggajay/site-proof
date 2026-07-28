/**
 * The panes the import review surface is built from: the counts bar, the source
 * grid, the corporate-master list and one proposal card.
 *
 * Extracted from `ImportReviewModal` so that file stays inside the 500-line
 * guideline while the review surface keeps growing (M10 added a per-row skip
 * and a read-level notice). Behaviour is unchanged by the move.
 */
import { useMemo } from 'react';
import { AlertTriangle, FileSpreadsheet } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { activitiesByFamily } from '@/lib/activityTaxonomy';
import type {
  CorporateMaster,
  DryRunResult,
  DryRunRow,
  ParsedSheet,
  Resolutions,
} from './importData';

const OUTCOME_LABEL: Record<DryRunRow['outcome'], string> = {
  create: 'Will import',
  update: 'Will update',
  skip: 'Skipped',
  needs_review: 'Needs a look',
  blocked: 'Must be fixed',
};

const OUTCOME_CHIP: Record<DryRunRow['outcome'], string> = {
  create: 'bg-success/10 text-success',
  update: 'bg-primary/10 text-primary',
  skip: 'bg-muted text-muted-foreground',
  needs_review: 'bg-warning/10 text-warning',
  blocked: 'bg-destructive/10 text-destructive',
};

const DIFF_LABEL: Record<'added' | 'removed' | 'changed', string> = {
  added: 'New',
  removed: 'Not in this version',
  changed: 'Changed',
};

const REASON_TEXT: Record<string, string> = {
  duplicate: 'Already in this project',
  slug_collision: 'Another row in this file has the same identity',
  unmapped_column: 'A column this import needs is not mapped',
  ambiguous_activity: 'The activity is only recognised at family level',
  unresolvable_activity: 'The activity is not recognised — pick one or skip it',
  over_length: 'A cell is longer than this field allows',
  state_spec_conflict: 'Declares a different specification set to this project',
  milestone_point_type: 'A milestone row needs a point type before it can import',
  invalid_value: 'A cell cannot be read as the value it needs to be',
  unsupported_attribute: 'A value is outside this project specification',
  template_not_found: 'The named ITP is not in this project',
  low_confidence: 'Read with low confidence',
  empty: 'Nothing to import from this row',
};

/** §4.5: the project's copy is controlled. Say what differs; never overwrite. */
function diffSummary(diff: NonNullable<DryRunRow['diff']>): string {
  const parts = [
    [diff.added, 'new'],
    [diff.changed, 'changed'],
    [diff.removed, 'not in this version'],
  ]
    .filter(([count]) => count)
    .map(([count, label]) => `${count} ${label}`);
  return `This project already has this ITP, and its copy differs — ${parts.join(', ')}. It is left as it is; update it by hand if you want these changes.`;
}

function rowDetail(row: DryRunRow): string {
  // The server's own wording, where a reason code alone cannot say enough.
  if (row.detail) return row.detail;
  if (row.diff) return diffSummary(row.diff);
  if (row.overLength) {
    return `${row.overLength.field} is ${row.overLength.length} characters (max ${row.overLength.max}). Shorten it at the source, or skip the row.`;
  }
  if (row.collidesWith?.length) {
    return `Also at ${row.collidesWith.map((ref) => `${ref.sheet} row ${ref.rowIndex}`).join(', ')}.`;
  }
  if (row.reason === 'state_spec_conflict') {
    return `This ITP declares ${row.declaredStateSpec}; this project uses a different specification set.`;
  }
  return REASON_TEXT[row.reason ?? ''] ?? '';
}

export function CountsBar({ counts }: { counts: DryRunResult['counts'] }) {
  const parts = [
    { label: 'import', value: counts.willImport },
    { label: 'skip', value: counts.willSkip },
    { label: 'need a look', value: counts.needsReview },
    { label: 'must be fixed', value: counts.blocked },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-muted/40 p-3 text-sm">
      {parts.map((part) => (
        <span key={part.label}>
          <span className="font-semibold">{part.value}</span>{' '}
          <span className="text-muted-foreground">{part.label}</span>
        </span>
      ))}
    </div>
  );
}

/** Left pane: the source, rendered as the grid it was read into. */
export function SourcePane({
  sheets,
  activeSheet,
}: {
  sheets: ParsedSheet[];
  activeSheet: string | null;
}) {
  const sheet = sheets.find((candidate) => candidate.name === activeSheet) ?? sheets[0];
  if (!sheet) {
    return <p className="text-sm text-muted-foreground">Source file no longer available.</p>;
  }

  return (
    <div className="min-w-0">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <FileSpreadsheet className="h-3.5 w-3.5" />
        {sheet.name}
      </p>
      <div className="max-h-[22rem] overflow-auto rounded-lg border">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 bg-muted">
            <tr>
              {sheet.headers.map((header, i) => (
                <th key={i} className="border-b px-2 py-1.5 text-left font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="odd:bg-muted/20">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="border-b px-2 py-1 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * B3 §4.5 — ITP sets already applied on another project, offered as corporate
 * masters. Picking one opens it here as a CONTROLLED COPY: the same dry run,
 * the same review, the same rollback, and a visible difference against anything
 * this project already has.
 */
export function CorporateMasterPanel({
  masters,
  busy,
  onUse,
}: {
  masters: CorporateMaster[];
  busy: boolean;
  onUse: (masterId: string) => void;
}) {
  return (
    <section aria-label="Corporate masters" className="rounded-lg border bg-card">
      <div className="border-b p-4">
        <h3 className="text-sm font-medium">Bring in a corporate master</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          An ITP set you already imported on another project. This project gets its own controlled
          copy — nothing here is overwritten.
        </p>
      </div>
      <ul className="divide-y">
        {masters.map((master) => (
          <li key={master.id} className="flex items-center gap-2 p-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {master.sourceFileName ?? 'ITP set'}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {master.projectName} · {master.templateCount}{' '}
                {master.templateCount === 1 ? 'ITP' : 'ITPs'}
              </span>
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onUse(master.id)}
            >
              Use this master
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * What the reviewer can decide about ONE proposed record. Every control here is
 * a `resolution` the next dry run is re-computed with; nothing is written.
 */
function RowResolutionControls({
  row,
  resolution,
  onResolve,
  busy,
}: {
  row: DryRunRow;
  resolution: Resolutions[string] | undefined;
  onResolve: (patch: Resolutions[string]) => void;
  busy: boolean;
}) {
  const families = useMemo(() => activitiesByFamily(), []);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {row.reason === 'unresolvable_activity' && (
        <NativeSelect
          aria-label={`Activity for ${row.label}`}
          disabled={busy}
          value={resolution?.activitySlug ?? ''}
          onChange={(event) => onResolve({ activitySlug: event.target.value || undefined })}
          className="h-8 max-w-[16rem] text-xs"
        >
          <option value="">Pick an activity…</option>
          {families.map((family) => (
            <optgroup key={family.slug} label={family.displayName}>
              {family.activities.map((activity) => (
                <option key={activity.slug} value={activity.slug}>
                  {activity.displayName}
                </option>
              ))}
            </optgroup>
          ))}
        </NativeSelect>
      )}

      {/* CivilPro's Milestone is approval-bearing and has no vocabulary value
          to fold to, so the server leaves it unresolved and the reviewer says
          what this template's milestones really are. One choice per template —
          matching TemplateResolution.milestoneAs. */}
      {row.reason === 'milestone_point_type' && (
        <NativeSelect
          aria-label={`Milestone point type for ${row.label}`}
          disabled={busy}
          value={resolution?.milestoneAs ?? ''}
          onChange={(event) =>
            onResolve({
              milestoneAs: (event.target.value || undefined) as Resolutions[string]['milestoneAs'],
            })
          }
          className="h-8 max-w-[16rem] text-xs"
        >
          <option value="">Pick a point type…</option>
          <option value="standard">S - Standard</option>
          <option value="witness">W - Witness</option>
          <option value="hold_point">H - Hold Point</option>
        </NativeSelect>
      )}

      {row.reason === 'state_spec_conflict' && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => onResolve({ affirmSpec: !resolution?.affirmSpec })}
        >
          {resolution?.affirmSpec ? 'Affirmed' : `Affirm ${row.declaredStateSpec} anyway`}
        </Button>
      )}

      {row.outcome !== 'skip' && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => onResolve({ skip: !resolution?.skip })}
        >
          {resolution?.skip ? 'Skipped — undo' : 'Leave this one out'}
        </Button>
      )}
    </div>
  );
}

/** Right pane: one card per proposed record, exceptions drilled into. */
export function ProposalRow({
  row,
  resolution,
  onResolve,
  onSelect,
  onSkipRow,
  rowSkipped,
  busy,
}: {
  row: DryRunRow;
  resolution: Resolutions[string] | undefined;
  onResolve: (patch: Resolutions[string]) => void;
  onSelect: () => void;
  /** M10: leave THIS checklist row out of its template. Absent when the row is
   *  not a checklist row, or when the server did not name its parent. */
  onSkipRow?: () => void;
  rowSkipped?: boolean;
  busy: boolean;
}) {
  const detail = rowDetail(row);

  return (
    <li className="rounded-lg border p-3">
      <button type="button" onClick={onSelect} className="w-full text-left">
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.label}</span>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${OUTCOME_CHIP[row.outcome]}`}
          >
            {rowSkipped ? OUTCOME_LABEL.skip : OUTCOME_LABEL[row.outcome]}
          </span>
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {row.rowRef.sheet} · row {row.rowRef.rowIndex}
          {row.checklistItemCount ? ` · ${row.checklistItemCount} checklist rows` : ''}
        </span>
      </button>

      {detail && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {detail}
        </p>
      )}

      {row.diff && row.diff.items.length > 0 && (
        <ul className="mt-2 space-y-1 border-l pl-3 text-xs text-muted-foreground">
          {row.diff.items.map((item, index) => (
            <li key={`${item.change}-${index}`} className="truncate">
              <span className="font-medium">{DIFF_LABEL[item.change]}:</span> {item.description}
            </li>
          ))}
        </ul>
      )}

      {/* M10: a blocked checklist row's own message says "shorten it, or skip
          the row", and `skipRows` is keyed on the TEMPLATE — so until the
          server named the parent, the reviewer was told to do something no
          control offered. One over-length cell blocked the whole ITP. */}
      {row.unit === 'checklist_row' && onSkipRow && (
        <div className="mt-3">
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onSkipRow}>
            {rowSkipped ? 'Skipped — undo' : 'Leave this row out'}
          </Button>
        </div>
      )}

      {row.unit !== 'checklist_row' && (
        <RowResolutionControls
          row={row}
          resolution={resolution}
          onResolve={onResolve}
          busy={busy}
        />
      )}
    </li>
  );
}

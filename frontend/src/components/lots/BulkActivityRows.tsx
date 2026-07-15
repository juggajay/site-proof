import { useEffect } from 'react';
import { ActivityTypeOptions } from '@/components/ActivityTypeOptions';
import { formatActivityLabel } from '@/lib/activityTaxonomy';
import { splitSuggestedTemplates, useTemplateMatch } from '@/lib/itpTemplateMatch';
import { type BulkActivity } from './bulkCreateLots';

export interface ItpTemplateOption {
  id: string;
  name: string;
  activityType?: string | null;
  isActive?: boolean;
}

interface BulkActivityRowsProps {
  projectId: string;
  activities: BulkActivity[];
  onChange: (activities: BulkActivity[]) => void;
  itpTemplates: ItpTemplateOption[];
  intervalCount: number;
}

/**
 * One row per activity (activity type + its own ITP template). Each activity
 * becomes a separate thin lot at every chainage interval, so N activities over
 * M intervals produce N×M lots.
 */
export function BulkActivityRows({
  projectId,
  activities,
  onChange,
  itpTemplates,
  intervalCount,
}: BulkActivityRowsProps) {
  const updateRow = (index: number, patch: Partial<BulkActivity>) => {
    onChange(activities.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };
  const addRow = () => {
    onChange([...activities, { activityType: 'earthworks_general', itpTemplateId: '' }]);
  };
  const removeRow = (index: number) => {
    if (activities.length <= 1) return;
    onChange(activities.filter((_, i) => i !== index));
  };

  const totalLots = intervalCount * activities.length;

  return (
    <div className="border-t border-border pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-foreground">Activities</label>
        <button
          type="button"
          onClick={addRow}
          className="text-sm font-medium text-primary hover:text-primary/80"
        >
          + Add activity
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Each activity becomes its own lot per interval, with its own ITP template.
      </p>
      {activities.map((row, index) => (
        <BulkActivityRow
          key={index}
          index={index}
          row={row}
          projectId={projectId}
          itpTemplates={itpTemplates}
          canRemove={activities.length > 1}
          onPatch={(patch) => updateRow(index, patch)}
          onRemove={() => removeRow(index)}
        />
      ))}
      {intervalCount > 0 && (
        <p className="text-sm font-medium text-foreground">
          {`${activities.length} ${activities.length === 1 ? 'activity' : 'activities'} × ${intervalCount} ${
            intervalCount === 1 ? 'interval' : 'intervals'
          } = ${totalLots} lots`}
        </p>
      )}
    </div>
  );
}

interface BulkActivityRowProps {
  index: number;
  row: BulkActivity;
  projectId: string;
  itpTemplates: ItpTemplateOption[];
  canRemove: boolean;
  onPatch: (patch: Partial<BulkActivity>) => void;
  onRemove: () => void;
}

function BulkActivityRow({
  index,
  row,
  projectId,
  itpTemplates,
  canRemove,
  onPatch,
  onRemove,
}: BulkActivityRowProps) {
  const match = useTemplateMatch(projectId, row.activityType);
  const { suggested, rest } = splitSuggestedTemplates(itpTemplates, match.data);

  // Tier A: prefill this row's template with the single exact-slug suggestion,
  // still editable. Only overrides when the current pick isn't a valid candidate
  // for the row's activity (so switching activity re-suggests, but a deliberate
  // pick survives).
  const tierAId = match.data?.tier === 'A' ? match.data.suggestedTemplateId : null;
  const currentIsCandidate =
    !!row.itpTemplateId &&
    (match.data?.candidates.some((c) => c.id === row.itpTemplateId) ?? false);
  useEffect(() => {
    if (tierAId && !currentIsCandidate) {
      onPatch({ itpTemplateId: tierAId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tierAId, currentIsCandidate]);

  return (
    <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
      <div>
        <label
          htmlFor={`bulk-activity-type-${index}`}
          className="block text-xs font-medium text-muted-foreground mb-1"
        >
          Activity Type
        </label>
        <select
          id={`bulk-activity-type-${index}`}
          value={row.activityType}
          onChange={(e) => onPatch({ activityType: e.target.value })}
          className="w-full px-3 py-2 border border-border rounded-md focus:ring-ring focus:border-ring"
        >
          <ActivityTypeOptions currentValue={row.activityType} />
        </select>
      </div>
      <div>
        <label
          htmlFor={`bulk-itp-template-${index}`}
          className="block text-xs font-medium text-muted-foreground mb-1"
        >
          ITP Template
        </label>
        <select
          id={`bulk-itp-template-${index}`}
          value={row.itpTemplateId ?? ''}
          onChange={(e) => onPatch({ itpTemplateId: e.target.value })}
          className="w-full px-3 py-2 border border-border rounded-md focus:ring-ring focus:border-ring"
        >
          <option value="">No ITP template</option>
          {suggested.length > 0 && (
            <optgroup label="Suggested">
              {suggested.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                  {template.activityType ? ` (${formatActivityLabel(template.activityType)})` : ''}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label={suggested.length > 0 ? 'All templates' : 'Templates'}>
            {rest.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
                {template.activityType ? ` (${formatActivityLabel(template.activityType)})` : ''}
              </option>
            ))}
          </optgroup>
        </select>
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        aria-label={`Remove activity ${index + 1}`}
        className="px-2 py-2 text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

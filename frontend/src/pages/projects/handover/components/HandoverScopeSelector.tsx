// Wave D `D1c.3` — the scope selector (§4.7.6).
//
// Not a convenience. Under the 8 GiB cap the selector is the only way a
// reference-dataset project is deliverable at all, so "one area" and "a range
// of lots" are first-class choices here rather than an advanced option behind a
// disclosure.

import { useEffect, useMemo, useState } from 'react';

import { NativeSelect } from '@/components/ui/native-select';
import {
  useProjectAreaOptions,
  useProjectLotOptions,
  type HandoverExportScope,
} from '../handoverExportData';

export type HandoverScopeKind = HandoverExportScope['kind'];

const SCOPE_CHOICES: { kind: HandoverScopeKind; label: string }[] = [
  { kind: 'project', label: 'Whole project' },
  { kind: 'area', label: 'One area' },
  { kind: 'lots', label: 'A range of lots' },
];

interface HandoverScopeSelectorProps {
  projectId: string;
  kind: HandoverScopeKind;
  onKindChange: (kind: HandoverScopeKind) => void;
  /** `null` while the chosen kind has no complete selection yet. */
  onScopeChange: (scope: HandoverExportScope | null) => void;
  disabled: boolean;
}

export function HandoverScopeSelector({
  projectId,
  kind,
  onKindChange,
  onScopeChange,
  disabled,
}: HandoverScopeSelectorProps) {
  const [areaId, setAreaId] = useState('');
  const [fromLotId, setFromLotId] = useState('');
  const [toLotId, setToLotId] = useState('');

  const areasQuery = useProjectAreaOptions(projectId, kind === 'area');
  const lotsQuery = useProjectLotOptions(projectId, kind === 'lots');

  const areas = areasQuery.data?.areas ?? [];
  const lots = useMemo(() => lotsQuery.data ?? [], [lotsQuery.data]);

  // The range is INCLUSIVE and taken over the register's own order, which is
  // what "lots 12 through 40" means to the person asking for it. Reversed
  // endpoints are read as the same range rather than as an empty one.
  const lotIds = useMemo(() => {
    const from = lots.findIndex((lot) => lot.id === fromLotId);
    const to = lots.findIndex((lot) => lot.id === toLotId);
    if (from === -1 || to === -1) return [];
    const [start, end] = from <= to ? [from, to] : [to, from];
    return lots.slice(start, end + 1).map((lot) => lot.id);
  }, [lots, fromLotId, toLotId]);

  useEffect(() => {
    if (kind === 'project') {
      onScopeChange({ kind: 'project' });
      return;
    }
    if (kind === 'area') {
      onScopeChange(areaId ? { kind: 'area', areaId } : null);
      return;
    }
    onScopeChange(lotIds.length > 0 ? { kind: 'lots', lotIds } : null);
  }, [kind, areaId, lotIds, onScopeChange]);

  return (
    <fieldset disabled={disabled} className="space-y-4">
      <legend className="text-sm font-medium text-foreground">What goes in the archive</legend>

      <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
        {SCOPE_CHOICES.map((choice) => (
          <label
            key={choice.kind}
            className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground has-[:checked]:border-primary"
          >
            <input
              type="radio"
              name="handover-scope-kind"
              value={choice.kind}
              checked={kind === choice.kind}
              onChange={() => onKindChange(choice.kind)}
              className="h-4 w-4"
            />
            {choice.label}
          </label>
        ))}
      </div>

      {kind === 'area' && (
        <div className="max-w-sm space-y-1">
          <label htmlFor="handover-area" className="text-sm text-muted-foreground">
            Area
          </label>
          <NativeSelect
            id="handover-area"
            value={areaId}
            onChange={(event) => setAreaId(event.target.value)}
          >
            <option value="">{areasQuery.isLoading ? 'Loading areas…' : 'Select an area'}</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </NativeSelect>
          {!areasQuery.isLoading && areas.length === 0 && (
            <p className="text-xs text-muted-foreground">
              This project has no areas defined yet. Use a range of lots instead.
            </p>
          )}
        </div>
      )}

      {kind === 'lots' && (
        <div className="grid max-w-xl gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="handover-lot-from" className="text-sm text-muted-foreground">
              From lot
            </label>
            <NativeSelect
              id="handover-lot-from"
              value={fromLotId}
              onChange={(event) => setFromLotId(event.target.value)}
            >
              <option value="">{lotsQuery.isLoading ? 'Loading lots…' : 'Select a lot'}</option>
              {lots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.lotNumber}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <label htmlFor="handover-lot-to" className="text-sm text-muted-foreground">
              To lot
            </label>
            <NativeSelect
              id="handover-lot-to"
              value={toLotId}
              onChange={(event) => setToLotId(event.target.value)}
            >
              <option value="">{lotsQuery.isLoading ? 'Loading lots…' : 'Select a lot'}</option>
              {lots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.lotNumber}
                </option>
              ))}
            </NativeSelect>
          </div>
          {lotIds.length > 0 && (
            <p className="text-xs text-muted-foreground sm:col-span-2">
              {lotIds.length} lots selected.
            </p>
          )}
        </div>
      )}
    </fieldset>
  );
}

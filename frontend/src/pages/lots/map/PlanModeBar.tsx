import { useQuery } from '@tanstack/react-query';

import { NativeSelect } from '@/components/ui/native-select';
import { queryKeys } from '@/lib/queryKeys';
import { fetchPlanSheet, type PlanSheetListItem } from '@/pages/projects/settings/planSheetsData';

interface PlanModeBarProps {
  projectId: string;
  sheet: PlanSheetListItem;
  sheets: PlanSheetListItem[];
  onSheetChange: (id: string) => void;
}

/**
 * Sheet identity + registration confidence, always visible in Plan mode: a
 * reader must know WHICH sheet they are on and how far its registration can be
 * trusted before they trust a lot boundary drawn over it.
 */
export function PlanModeBar({ projectId, sheet, sheets, onSheetChange }: PlanModeBarProps) {
  // The list payload omits the raw registration; the detail fetch carries
  // rmsErrorM. Cached per sheet — switching back is free.
  const detail = useQuery({
    queryKey: queryKeys.planSheet(projectId, sheet.id),
    queryFn: () => fetchPlanSheet(projectId, sheet.id),
    staleTime: 60_000,
  });
  const rms = detail.data?.registration?.rmsErrorM;

  return (
    <div
      className="pointer-events-auto flex w-fit flex-wrap items-center gap-x-2.5 gap-y-1 rounded-md border bg-background/95 px-2.5 py-1.5 text-xs shadow-sm"
      data-testid="plan-mode-bar"
    >
      {sheets.length > 1 ? (
        <NativeSelect
          value={sheet.id}
          onChange={(e) => onSheetChange(e.target.value)}
          aria-label="Active sheet"
          className="h-7 w-auto py-0 text-xs font-semibold"
          data-testid="plan-sheet-select"
        >
          {sheets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
      ) : (
        <span className="font-semibold">{sheet.name}</span>
      )}
      <span className="text-muted-foreground">
        p.{sheet.pageNumber} · {sheet.coordinateSystem}
      </span>
      <span
        className="rounded-full border bg-secondary px-2 py-0.5 font-mono text-[10px] font-semibold"
        title="Registration RMS error across the sheet's control points"
        data-testid="plan-registration-confidence"
      >
        {rms != null
          ? `Registration ±${rms.toFixed(2)} m`
          : detail.isLoading
            ? 'Registration…'
            : 'Registration accuracy unknown'}
      </span>
    </div>
  );
}

export default PlanModeBar;

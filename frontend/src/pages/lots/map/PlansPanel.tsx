import { Crosshair } from 'lucide-react';

import type { PlanSheetListItem } from '@/pages/projects/settings/planSheetsData';

interface PlansPanelProps {
  projectId: string;
  sheets: PlanSheetListItem[];
  shown: Record<string, boolean>;
  opacity: number;
  offscreenIds: Set<string>;
  onToggle: (id: string) => void;
  onOpacityChange: (value: number) => void;
  onZoom: (id: string) => void;
}

/**
 * Toolbar popover for plan-sheet overlays: a checkbox per registered sheet, a
 * single opacity slider for shown sheets, and a "Zoom to sheet" shortcut when a
 * shown sheet sits outside the current view.
 */
export function PlansPanel({
  projectId,
  sheets,
  shown,
  opacity,
  offscreenIds,
  onToggle,
  onOpacityChange,
  onZoom,
}: PlansPanelProps) {
  const anyShown = sheets.some((sheet) => shown[sheet.id]);

  return (
    <div
      className="mt-2 w-72 max-w-[calc(100vw-1.5rem)] max-h-[60vh] overflow-y-auto rounded-md border bg-background p-3 shadow-lg"
      data-testid="plans-panel"
    >
      {sheets.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No registered plan sheets yet. Upload and georeference drawings in{' '}
          <a
            href={`/projects/${encodeURIComponent(projectId)}/settings`}
            className="text-primary hover:underline"
          >
            Project settings → Plan sheets
          </a>{' '}
          to overlay them here.
        </p>
      ) : (
        <>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Plan sheets</p>
          <ul className="space-y-1.5">
            {sheets.map((sheet) => (
              <li key={sheet.id} className="flex items-center gap-2">
                <label className="flex flex-1 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(shown[sheet.id])}
                    onChange={() => onToggle(sheet.id)}
                    data-testid={`plan-toggle-${sheet.id}`}
                  />
                  <span className="truncate" title={sheet.name}>
                    {sheet.name}
                  </span>
                </label>
                {shown[sheet.id] && offscreenIds.has(sheet.id) && (
                  <button
                    type="button"
                    onClick={() => onZoom(sheet.id)}
                    className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                    data-testid={`plan-zoom-${sheet.id}`}
                  >
                    <Crosshair className="h-3 w-3" /> Zoom
                  </button>
                )}
              </li>
            ))}
          </ul>

          {anyShown && (
            <label className="mt-3 block text-xs text-muted-foreground">
              Opacity
              <input
                type="range"
                min={0.2}
                max={1}
                step={0.05}
                value={opacity}
                onChange={(e) => onOpacityChange(Number(e.target.value))}
                className="mt-1 w-full"
                data-testid="plan-opacity"
              />
            </label>
          )}
        </>
      )}
    </div>
  );
}

export default PlansPanel;

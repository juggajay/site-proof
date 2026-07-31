import { Crosshair, X } from 'lucide-react';

import type { PlanSheetListItem } from '@/pages/projects/settings/planSheetsData';

interface PlansPanelProps {
  /** Settings page href; null (foreman shell) renders the mention as plain text. */
  settingsHref: string | null;
  sheets: PlanSheetListItem[];
  shown: Record<string, boolean>;
  opacity: number;
  blend: boolean;
  offscreenIds: Set<string>;
  onToggle: (id: string) => void;
  onOpacityChange: (value: number) => void;
  onBlendChange: (value: boolean) => void;
  onZoom: (id: string) => void;
  /**
   * DG-4b. The panel now opens from the Layers chooser rather than a toolbar
   * toggle, so it has to carry its own way out — the way Coverage and Test
   * coverage already do.
   */
  onClose: () => void;
}

/**
 * Toolbar popover for plan-sheet overlays: a checkbox per registered sheet, a
 * single opacity slider for shown sheets, and a "Zoom to sheet" shortcut when a
 * shown sheet sits outside the current view.
 */
export function PlansPanel({
  settingsHref,
  sheets,
  shown,
  opacity,
  blend,
  offscreenIds,
  onToggle,
  onOpacityChange,
  onBlendChange,
  onZoom,
  onClose,
}: PlansPanelProps) {
  const anyShown = sheets.some((sheet) => shown[sheet.id]);

  return (
    <div
      className="w-72 max-w-[calc(100vw-1.5rem)] max-h-[60vh] overflow-y-auto rounded-md border bg-background p-3 shadow-lg"
      data-testid="plans-panel"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">Plan overlays</p>
        <button
          type="button"
          onClick={onClose}
          className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close plan overlays"
          data-testid="plans-close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {sheets.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No registered plan sheets yet. Upload and georeference drawings in{' '}
          {settingsHref ? (
            <a href={settingsHref} className="text-primary hover:underline">
              Project settings → Plan sheets
            </a>
          ) : (
            <span className="font-medium">Project settings → Plan sheets</span>
          )}{' '}
          to overlay them here.
        </p>
      ) : (
        <>
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
            <>
              <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={blend}
                  onChange={(e) => onBlendChange(e.target.checked)}
                  data-testid="plan-blend"
                />
                Blend into map
              </label>
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
            </>
          )}
        </>
      )}
    </div>
  );
}

export default PlansPanel;

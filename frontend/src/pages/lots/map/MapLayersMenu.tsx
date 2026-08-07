import {
  ChevronRight,
  Image as ImageIcon,
  FlaskConical,
  Map as MapIcon,
  Satellite,
  Waypoints,
} from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BottomSheet } from '@/components/foreman/sheets/BottomSheet';
import { cn } from '@/lib/utils';

import type {
  MapBasemapId,
  MapLayerMenuModel,
  MapPanelId,
  MapPanelRow,
  MapOrthoLayerRow,
  MapPinLayerId,
  MapPinLayerRow,
} from './mapLayerRows';

const PIN_ICON: Record<MapPinLayerId, typeof ImageIcon> = {
  photos: ImageIcon,
  testPins: FlaskConical,
};

const PANEL_ICON: Record<MapPanelId, typeof ImageIcon> = {
  plans: MapIcon,
  coverage: Waypoints,
  testCoverage: FlaskConical,
};

const BASEMAPS: { id: MapBasemapId; label: string; icon: typeof ImageIcon }[] = [
  { id: 'satellite', label: 'Satellite', icon: Satellite },
  { id: 'street', label: 'Street', icon: MapIcon },
];

interface MapLayersMenuProps {
  isMobile: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * The Layers control itself. Rendered by the caller so it is the same
   * ToolbarButton as every other control (one place owns tile styling); on
   * desktop it is handed to Radix as the menu trigger.
   */
  trigger: React.ReactNode;
  model: MapLayerMenuModel;
  onTogglePin: (id: MapPinLayerId) => void;
  onOpenPanel: (id: MapPanelId) => void;
  onToggleOrtho: (id: string) => void;
  onOrthoOpacityChange: (id: string, opacity: number) => void;
  /**
   * QA/RT-02, mobile only. The phone has no Leaflet basemap switcher — the CIVOS
   * toolbar spans the whole top strip and covered it in every corner — so the
   * choice lives on this sheet. Desktop's native top-right control is untouched
   * and these are ignored there.
   */
  basemap: MapBasemapId;
  onBasemapChange: (id: MapBasemapId) => void;
  /** False without a MapTiler key: one basemap exists, so no choice is offered. */
  satelliteAvailable: boolean;
}

/** "Test pins, Coverage and Test coverage are live-only." */
function liveOnlySentence(names: string[]): string {
  if (names.length === 0) return '';
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  const verb = names.length === 1 ? 'is' : 'are';
  return `${list} ${verb} live-only. They read today's records, so they are not offered against a past date. Exit Past view to use them.`;
}

function countLabel(count: number | null): string | null {
  return count === null ? null : `${count} in view`;
}

/**
 * The map's one layer chooser: a DropdownMenu on desktop, the shipped foreman
 * BottomSheet on mobile. Both render the same model, so a pin layer cannot be
 * on in one and off in the other.
 */
export function MapLayersMenu({
  isMobile,
  open,
  onOpenChange,
  trigger,
  model,
  onTogglePin,
  onOpenPanel,
  onToggleOrtho,
  onOrthoOpacityChange,
  basemap,
  onBasemapChange,
  satelliteAvailable,
}: MapLayersMenuProps) {
  const liveOnly = liveOnlySentence(model.liveOnly);

  if (isMobile) {
    return (
      <>
        {trigger}
        <BottomSheet isOpen={open} onClose={() => onOpenChange(false)} title="Map layers">
          <div data-testid="map-layers-sheet">
            {/* Without a MapTiler key there is exactly one basemap, so the whole
                section goes — a locked single choice is not a choice, and it is
                the same thing the Leaflet control did (it only ever rendered the
                BaseLayers that existed). */}
            {satelliteAvailable && (
              <div data-testid="map-basemap-section">
                <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Basemap
                </p>
                {BASEMAPS.map(({ id, label, icon: Icon }) => (
                  <SheetChoiceRow
                    key={id}
                    role="menuitemradio"
                    checked={basemap === id}
                    icon={Icon}
                    label={label}
                    onClick={() => onBasemapChange(id)}
                    testId={`map-basemap-${id}`}
                  />
                ))}
              </div>
            )}

            <p
              className={cn(
                'px-1 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground',
                satelliteAvailable && 'mt-4 border-t pt-4',
              )}
            >
              Show on map
            </p>
            {model.pins.map((row) => (
              <SheetPinRow key={row.id} row={row} onToggle={() => onTogglePin(row.id)} />
            ))}

            {model.orthos.length > 0 && (
              <>
                <p className="mt-4 border-t px-1 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Drone imagery · up to 2
                </p>
                {model.orthos.map((row) => (
                  <SheetOrthoRow
                    key={row.id}
                    row={row}
                    onToggle={() => onToggleOrtho(row.id)}
                    onOpacityChange={(opacity) => onOrthoOpacityChange(row.id, opacity)}
                  />
                ))}
              </>
            )}

            <p className="mt-4 border-t px-1 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Open a panel
            </p>
            {model.panels.map((row) => (
              <SheetPanelRow key={row.id} row={row} onOpen={() => onOpenPanel(row.id)} />
            ))}
            <p className="px-1 pt-3 text-xs text-muted-foreground">
              These {model.panels.length === 1 ? 'closes' : 'close'} this sheet and open their own
              panel over the map.
            </p>
            {liveOnly && (
              <p
                className="px-1 pt-2 text-xs text-muted-foreground"
                data-testid="map-layers-live-only"
              >
                {liveOnly}
              </p>
            )}
          </div>
        </BottomSheet>
      </>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72" data-testid="map-layers-menu">
        <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Show on map
        </DropdownMenuLabel>
        {model.pins.map((row) => {
          const Icon = PIN_ICON[row.id];
          const count = countLabel(row.count);
          return (
            <DropdownMenuCheckboxItem
              key={row.id}
              checked={row.checked}
              // Keep the menu open: arming two layers is one errand, not two.
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={() => onTogglePin(row.id)}
              data-testid={`map-layer-${row.id}`}
            >
              <Icon className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden />
              <span>{row.label}</span>
              {count && <span className="ml-auto text-xs text-muted-foreground">{count}</span>}
            </DropdownMenuCheckboxItem>
          );
        })}

        {model.orthos.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Drone imagery · up to 2
            </DropdownMenuLabel>
            {model.orthos.map((row) => (
              <div key={row.id}>
                <DropdownMenuCheckboxItem
                  checked={row.checked}
                  disabled={row.disabled}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={() => onToggleOrtho(row.id)}
                  data-testid={`map-ortho-${row.id}`}
                >
                  <Satellite className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{row.label}</span>
                  {row.capturedAt && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {new Date(row.capturedAt).toLocaleDateString()}
                    </span>
                  )}
                </DropdownMenuCheckboxItem>
                {row.checked && (
                  <label className="flex items-center gap-2 px-8 pb-2 text-xs text-muted-foreground">
                    Opacity
                    <input
                      type="range"
                      min={0.2}
                      max={1}
                      step={0.05}
                      value={row.opacity}
                      onChange={(event) => onOrthoOpacityChange(row.id, Number(event.target.value))}
                      className="min-w-0 flex-1"
                      data-testid={`map-ortho-opacity-${row.id}`}
                    />
                  </label>
                )}
              </div>
            ))}
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Open a panel
        </DropdownMenuLabel>
        {model.panels.map((row) => {
          const Icon = PANEL_ICON[row.id];
          return (
            <DropdownMenuItem
              key={row.id}
              onSelect={() => onOpenPanel(row.id)}
              data-testid={`map-panel-${row.id}`}
            >
              <Icon className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden />
              <span>{row.label}</span>
              <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                {row.detail}
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </span>
            </DropdownMenuItem>
          );
        })}
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          Panels open over the map and close this list. Their own state stays visible in the panel.
        </p>
        {liveOnly && (
          <p
            className="px-2 pb-1.5 text-xs text-muted-foreground"
            data-testid="map-layers-live-only"
          >
            {liveOnly}
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * A settable row on the mobile sheet. The WHOLE 56px row is the button — not a
 * 40x24 switch floating at the end of it — and the state is carried by
 * `aria-checked`, not a colour.
 *
 * `role` is the row's whole meaning: `menuitemcheckbox` for a pin layer (a set —
 * arm as many as you like), `menuitemradio` for the basemap (a choice — exactly
 * one). The indicator follows it: a square tick box vs a round radio dot.
 */
function SheetChoiceRow({
  role,
  checked,
  icon: Icon,
  label,
  detail,
  onClick,
  testId,
}: {
  role: 'menuitemcheckbox' | 'menuitemradio';
  checked: boolean;
  icon: typeof ImageIcon;
  label: string;
  detail?: string | null;
  onClick: () => void;
  testId: string;
}) {
  const radio = role === 'menuitemradio';
  return (
    <button
      type="button"
      role={role}
      aria-checked={checked}
      onClick={onClick}
      className="flex min-h-[56px] w-full items-center gap-3 border-t px-1 text-left first:border-t-0"
      data-testid={testId}
    >
      <span
        className={cn(
          'flex h-[22px] w-[22px] flex-none items-center justify-center border-2',
          radio ? 'rounded-full' : 'rounded',
          checked
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-muted-foreground/60 bg-card',
        )}
        aria-hidden
      >
        {checked &&
          (radio ? (
            <span className="h-2 w-2 rounded-full bg-current" />
          ) : (
            <svg
              viewBox="0 0 24 24"
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path d="m20 6-11 11-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ))}
      </span>
      <Icon className="h-5 w-5 flex-none text-muted-foreground" aria-hidden />
      <span className="flex-1 text-[15px]">{label}</span>
      {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
    </button>
  );
}

/** A pin layer on the mobile sheet: a checkbox row, because layers are a set. */
function SheetPinRow({ row, onToggle }: { row: MapPinLayerRow; onToggle: () => void }) {
  return (
    <SheetChoiceRow
      role="menuitemcheckbox"
      checked={row.checked}
      icon={PIN_ICON[row.id]}
      label={row.label}
      detail={countLabel(row.count)}
      onClick={onToggle}
      testId={`map-layer-${row.id}`}
    />
  );
}

/** A panel row: a plain button with a chevron, so it never reads as a setting. */
function SheetPanelRow({ row, onOpen }: { row: MapPanelRow; onOpen: () => void }) {
  const Icon = PANEL_ICON[row.id];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-[56px] w-full items-center gap-3 border-t px-1 text-left first:border-t-0"
      data-testid={`map-panel-${row.id}`}
    >
      <Icon className="h-5 w-5 flex-none text-muted-foreground" aria-hidden />
      <span className="flex-1 text-[15px]">{row.label}</span>
      {row.detail && <span className="text-xs text-muted-foreground">{row.detail}</span>}
      <ChevronRight className="h-5 w-5 flex-none text-muted-foreground" aria-hidden />
    </button>
  );
}

function SheetOrthoRow({
  row,
  onToggle,
  onOpacityChange,
}: {
  row: MapOrthoLayerRow;
  onToggle: () => void;
  onOpacityChange: (opacity: number) => void;
}) {
  return (
    <div className="border-t first:border-t-0">
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={row.checked}
        disabled={row.disabled}
        onClick={onToggle}
        className="flex min-h-[56px] w-full items-center gap-3 px-1 text-left disabled:opacity-50"
        data-testid={`map-ortho-${row.id}`}
      >
        <span
          className={cn(
            'flex h-[22px] w-[22px] flex-none items-center justify-center rounded border-2',
            row.checked
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-muted-foreground/60 bg-card',
          )}
          aria-hidden
        >
          {row.checked && <span>✓</span>}
        </span>
        <Satellite className="h-5 w-5 flex-none text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[15px]">{row.label}</span>
        {row.capturedAt && (
          <span className="text-xs text-muted-foreground">
            {new Date(row.capturedAt).toLocaleDateString()}
          </span>
        )}
      </button>
      {row.checked && (
        <label className="flex items-center gap-2 px-1 pb-3 pl-12 text-xs text-muted-foreground">
          Opacity
          <input
            type="range"
            min={0.2}
            max={1}
            step={0.05}
            value={row.opacity}
            onChange={(event) => onOpacityChange(Number(event.target.value))}
            className="min-w-0 flex-1"
            data-testid={`map-ortho-opacity-${row.id}`}
          />
        </label>
      )}
    </div>
  );
}

export default MapLayersMenu;

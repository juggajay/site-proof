import { forwardRef } from 'react';
import {
  Crosshair,
  History,
  Image as ImageIcon,
  ImageDown,
  Layers,
  Maximize,
  PencilRuler,
  Square,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';

import { MapLayersMenu } from './MapLayersMenu';
import type { MapBasemapId, MapLayerMenuModel, MapPanelId, MapPinLayerId } from './mapLayerRows';

// Mirrors RESULT_CAP in backend/src/routes/spatialSearch.ts. The wire only
// carries a boolean (`photosTruncated` / `testResultsTruncated`), so the number
// has to be stated here to say WHICH first-N a reader is looking at. A map that
// silently drops the 501st pin is a map that lies about what is on the ground.
const PIN_RESULT_CAP = 500;

/**
 * Map toolbar control.
 *
 * DG-4b: on mobile this is a CAPTIONED TILE, never a bare icon. Tiles share the
 * row (`flex-1` between a 48px floor and a 56px ceiling) so six controls land at
 * 56px and seven at 48px on a 390px phone — no horizontal scroll, no overflow
 * menu, and nothing a foreman needs two taps away. The caption is the point: an
 * unlabelled icon on a jobsite is a guess.
 *
 * `label` is the stable accessible name ("Cancel draw"), `text` the desktop
 * caption, `short` the tile caption ("Cancel") — a tile has ~7 characters before
 * it wraps, and the accessible name must not shrink to fit.
 */
export const ToolbarButton = forwardRef<
  HTMLButtonElement,
  // Extends the native button props so `DropdownMenuTrigger asChild` can inject
  // its handlers and aria-expanded. Without the spread below the desktop Layers
  // menu never opens — Radix's props land nowhere.
  Omit<React.ComponentPropsWithoutRef<'button'>, 'children' | 'className'> & {
    icon: LucideIcon;
    label: string;
    text?: string;
    short?: string;
    pressed?: boolean;
    tile: boolean;
    testId: string;
    /** Small numeric badge (armed pin layers on the Layers control). */
    count?: number;
    /**
     * A layer this control owns has failed. Drawn as a red dot so the state
     * SURVIVES the menu closing — the detail stays in the on-map notice.
     */
    alert?: boolean;
  }
>(function ToolbarButton(
  { icon: Icon, label, text, short, pressed, tile, testId, count, alert, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      className={cn(
        'pointer-events-auto relative rounded-md border text-sm font-medium shadow-sm disabled:opacity-50',
        tile
          ? 'flex min-h-[58px] min-w-12 max-w-14 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-1'
          : 'inline-flex items-center justify-center gap-1.5 px-3 py-1.5',
        pressed ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
      )}
      data-testid={testId}
    >
      <Icon className={tile ? 'h-5 w-5' : 'h-3.5 w-3.5'} aria-hidden />
      <span className={tile ? 'text-center text-[9.5px] font-semibold leading-tight' : undefined}>
        {tile ? (short ?? text ?? label) : (text ?? label)}
      </span>
      {count != null && count > 0 && (
        <span
          className={cn(
            'font-mono text-[9px] font-bold leading-none',
            tile ? 'absolute right-1 top-1' : 'ml-0.5',
          )}
          data-testid={`${testId}-count`}
        >
          {count}
        </span>
      )}
      {alert && (
        <span
          className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-background bg-destructive text-[8px] font-bold leading-none text-destructive-foreground"
          data-testid={`${testId}-alert`}
          aria-hidden
        >
          !
        </span>
      )}
    </button>
  );
});

/** One half of the Map/Plan segmented mode switch. */
function ModeButton({
  active,
  disabled,
  onClick,
  testId,
  title,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  testId: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 text-sm font-medium disabled:opacity-50',
        active ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
      )}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

/** Group rule between toolbar groups (Locate / Search / Tools / Past). */
function GroupRule({ isMobile }: { isMobile: boolean }) {
  return (
    <span
      className={cn(
        'w-px flex-none self-stretch bg-foreground/25',
        isMobile ? 'mx-1 my-1.5' : 'mx-1',
      )}
      aria-hidden
    />
  );
}

interface MapToolbarProps {
  isMobile: boolean;
  /** Which canvas the workspace is showing; Plan needs a registered sheet. */
  mode: 'map' | 'plan';
  onModeChange: (mode: 'map' | 'plan') => void;
  planAvailable: boolean;
  drawArmed: boolean;
  onFindByArea: () => void;
  locating: boolean;
  /** False until the Leaflet instance exists — Locate has nothing to fly. */
  canLocate: boolean;
  onLocate: () => void;
  /** False until the map and some fit-able extent both exist. */
  canFit: boolean;
  /** The explicit camera-policy escape hatch: fit the visible lot set. */
  onFit: () => void;
  photosArmed: boolean;
  onTogglePhotos: () => void;
  layersOpen: boolean;
  onLayersOpenChange: (open: boolean) => void;
  layerModel: MapLayerMenuModel;
  onTogglePin: (id: MapPinLayerId) => void;
  onOpenPanel: (id: MapPanelId) => void;
  /** Mobile only — the basemap the Layers sheet offers and the map draws. */
  basemap: MapBasemapId;
  onBasemapChange: (id: MapBasemapId) => void;
  /** False without a MapTiler key: there is one basemap and nothing to choose. */
  satelliteAvailable: boolean;
  /** Armed marker layers whose viewport fetch failed, by display name. */
  unavailablePinLayers: string[];
  /** Armed marker layers the backend capped, by display name. */
  truncatedPinLayers: string[];
  canManageSettings: boolean;
  drawLotArmed: boolean;
  onDrawLot: () => void;
  snapshotting: boolean;
  onSnapshot: () => void;
  historyArmed: boolean;
  onToggleHistory: () => void;
}

/**
 * The map's control row and the notices that belong to it.
 *
 * Rendered as a fragment inside LotMapView's `pointer-events-none` column, so
 * the transparent gaps between controls stay draggable — the map has to remain
 * usable underneath its own toolbar.
 */
export function MapToolbar({
  isMobile,
  mode,
  onModeChange,
  planAvailable,
  drawArmed,
  onFindByArea,
  locating,
  canLocate,
  onLocate,
  canFit,
  onFit,
  photosArmed,
  onTogglePhotos,
  layersOpen,
  onLayersOpenChange,
  layerModel,
  onTogglePin,
  onOpenPanel,
  basemap,
  onBasemapChange,
  satelliteAvailable,
  unavailablePinLayers,
  truncatedPinLayers,
  canManageSettings,
  drawLotArmed,
  onDrawLot,
  snapshotting,
  onSnapshot,
  historyArmed,
  onToggleHistory,
}: MapToolbarProps) {
  return (
    <>
      {/* Mode is its own row, first: it decides what canvas everything below
          acts on. Plan needs a registered sheet to mean anything. */}
      <div className="flex">
        <div
          className="pointer-events-auto inline-flex overflow-hidden rounded-md border shadow-sm"
          role="group"
          aria-label="Map mode"
          data-testid="map-mode-switch"
        >
          <ModeButton
            active={mode === 'map'}
            onClick={() => onModeChange('map')}
            testId="mode-map-button"
          >
            Map
          </ModeButton>
          <ModeButton
            active={mode === 'plan'}
            disabled={!planAvailable}
            title={planAvailable ? undefined : 'Register a plan sheet to enable Plan mode'}
            onClick={() => onModeChange('plan')}
            testId="mode-plan-button"
          >
            Plan
          </ModeButton>
        </div>
      </div>
      <div
        className={cn(
          'flex items-stretch',
          // Mobile: tiles SHARE the row (flex-1, 48–56px) so six land at 56px
          // and seven at 48px on a 390px phone. Desktop wraps.
          isMobile ? 'gap-[3px]' : 'flex-wrap items-center gap-2',
        )}
        data-testid="lot-map-toolbar"
      >
        {mode === 'plan' ? (
          // Plan mode is a reading/selecting canvas: geographic tools (GPS,
          // find-by-area, draw, history, layers) stay on the Map canvas.
          <>
            {!isMobile && (
              <ToolbarButton
                icon={Maximize}
                label="Fit sheet"
                text="Fit"
                onClick={onFit}
                disabled={!canFit}
                tile={false}
                testId="fit-lots-button"
              />
            )}
            <ToolbarButton
              icon={ImageDown}
              label="Save map"
              text={snapshotting ? 'Saving…' : 'Save map'}
              short={snapshotting ? 'Saving…' : 'Save map'}
              onClick={onSnapshot}
              disabled={snapshotting}
              tile={isMobile}
              testId="snapshot-button"
            />
          </>
        ) : (
          <>
            {/* ── Locate ── */}
            <ToolbarButton
              icon={Crosshair}
              label="My location"
              text={locating ? 'Locating…' : 'My location'}
              short={locating ? 'Locating…' : 'Locate'}
              onClick={onLocate}
              disabled={locating || !canLocate}
              tile={isMobile}
              testId="locate-me-button"
            />
            {/* The camera policy's explicit escape hatch — desktop only: the
                phone row is at its tile budget and pinch covers recovery. */}
            {!isMobile && (
              <ToolbarButton
                icon={Maximize}
                label="Fit lots"
                text="Fit"
                onClick={onFit}
                disabled={!canFit}
                tile={false}
                testId="fit-lots-button"
              />
            )}
            <GroupRule isMobile={isMobile} />
            {/* ── Search ── */}
            <ToolbarButton
              icon={Square}
              label="Find by area"
              text={drawArmed ? 'Cancel' : 'Find by area'}
              short={drawArmed ? 'Cancel' : 'Area'}
              onClick={onFindByArea}
              pressed={drawArmed}
              tile={isMobile}
              testId="find-by-area-button"
            />
            <GroupRule isMobile={isMobile} />
            {/* ── Tools ── */}
            {/* Photos earns a top-level tile on the phone and only there: it is
                the layer a foreman reaches for most, and burying it one tap
                deeper is the whole failure the tiles fix. On desktop the
                pointer makes the menu cheap, so it lives there only. */}
            {isMobile && (
              <ToolbarButton
                icon={ImageIcon}
                label="Photos"
                short="Photos"
                onClick={onTogglePhotos}
                pressed={photosArmed}
                tile
                testId="photos-button"
              />
            )}
            <MapLayersMenu
              isMobile={isMobile}
              open={layersOpen}
              onOpenChange={onLayersOpenChange}
              model={layerModel}
              onTogglePin={onTogglePin}
              onOpenPanel={onOpenPanel}
              basemap={basemap}
              onBasemapChange={onBasemapChange}
              satelliteAvailable={satelliteAvailable}
              trigger={
                <ToolbarButton
                  icon={Layers}
                  label="Layers"
                  short="Layers"
                  // Desktop: Radix owns the trigger's click. Mobile: the tile
                  // opens the sheet itself.
                  onClick={isMobile ? () => onLayersOpenChange(true) : undefined}
                  pressed={layersOpen || layerModel.armedCount > 0}
                  count={layerModel.armedCount}
                  alert={unavailablePinLayers.length > 0}
                  tile={isMobile}
                  testId="layers-button"
                />
              }
            />
            {canManageSettings && (
              <ToolbarButton
                icon={PencilRuler}
                label={drawLotArmed ? 'Cancel draw' : 'Draw lot'}
                text={drawLotArmed ? 'Cancel draw' : 'Draw lot'}
                short={drawLotArmed ? 'Cancel' : 'Draw lot'}
                onClick={onDrawLot}
                pressed={drawLotArmed}
                tile={isMobile}
                testId="draw-lot-button"
              />
            )}
            {/* "Save map", not "Snapshot": it writes a PNG of the map to
                project Documents. The camera icon said "take a photo". */}
            <ToolbarButton
              icon={ImageDown}
              label="Save map"
              text={snapshotting ? 'Saving…' : 'Save map'}
              short={snapshotting ? 'Saving…' : 'Save map'}
              onClick={onSnapshot}
              disabled={snapshotting}
              tile={isMobile}
              testId="snapshot-button"
            />
            {/* A rule, not a gap: Past is not an "act" peer of the controls to
                its left — it changes what every polygon on the map MEANS. */}
            <GroupRule isMobile={isMobile} />
            <ToolbarButton
              icon={History}
              label={historyArmed ? 'Exit Past view' : 'Past view'}
              text={historyArmed ? 'Exit Past view' : 'Past'}
              short="Past"
              onClick={onToggleHistory}
              pressed={historyArmed}
              tile={isMobile}
              testId="history-button"
            />
          </>
        )}
      </div>

      <div className="flex flex-col items-start gap-1.5">
        {/* AT-94 `[C3S-d]`. Both marker layers ride `spatial-search`, a POST that
            is deliberately NOT in the offline runtime cache — nothing stale is
            ever shown. So when a fetch fails the layer must SAY it is
            unavailable: an empty map reads as "no pins here", which is a
            different statement and a false one.

            It stays ON THE MAP rather than inside the chooser: a notice that
            only exists while a menu is open is a notice nobody reads. */}
        {unavailablePinLayers.length > 0 && (
          <p
            className="max-w-[16rem] rounded border border-destructive/50 bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow"
            role="status"
            data-testid="map-pin-layers-unavailable"
          >
            {unavailablePinLayers.join(' and ')} {unavailablePinLayers.length > 1 ? 'are' : 'is'}{' '}
            unavailable
            {navigator.onLine ? ' right now' : ' offline'} — nothing stale is shown.
          </p>
        )}
        {truncatedPinLayers.length > 0 && (
          <p
            className="max-w-[18rem] rounded bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow"
            role="status"
            data-testid="map-pin-layers-truncated"
          >
            <span className="mr-1.5 inline-flex items-center rounded-full border bg-secondary px-2 py-0.5 font-mono text-[10px] font-semibold text-foreground">
              {PIN_RESULT_CAP}+
            </span>
            Showing the first {PIN_RESULT_CAP} {truncatedPinLayers.join(' and ')} in this view. Zoom
            in to see the rest.
          </p>
        )}
        {drawArmed && (
          <p className="max-w-[12rem] rounded bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow">
            {isMobile
              ? 'Drag a box on the map. Tap the button again to cancel.'
              : 'Drag a box on the map. Press Esc to cancel.'}
          </p>
        )}
        {drawLotArmed && (
          <p className="max-w-[14rem] rounded bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow">
            {isMobile
              ? 'Tap to place polygon corners; double-tap to finish. Tap the button again to cancel.'
              : 'Click to place polygon corners; double-click to finish. Press Esc to cancel.'}
          </p>
        )}
      </div>
    </>
  );
}

export default MapToolbar;

import { useCallback, useMemo } from 'react';
import { ImageOverlay, MapContainer, ZoomControl } from 'react-leaflet';
import L from 'leaflet';

import type { PlanSheetListItem } from '@/pages/projects/settings/planSheetsData';

import type { GeoJsonFeature, ProjectLotGeometry } from './lotMapData';
import { featureCentroid, type LatLng } from './lotMapHelpers';
import { LotsGeoJsonLayer, type LotSelectEvent } from './LotsGeoJsonLayer';
import { LotLabelsLayer, type LabelLot } from './LotLabelsLayer';
import { chainageLabel } from './lotMapData';
import { buildSheetSpace, featureToSheet } from './sheetTransform';
import { usePlanOverlayImage } from './usePlanOverlayImage';

const planTier = (zoom: number): 'number' | 'detail' => (zoom >= 1 ? 'detail' : 'number');

interface PlanModeCanvasProps {
  projectId: string;
  /** The ONE active sheet — plan mode is a single-sheet canvas by design. */
  sheet: PlanSheetListItem;
  geometries: ProjectLotGeometry[];
  colorFor: (lotId: string, status: string) => string;
  selectedLotId: string | null;
  onSelect: (event: LotSelectEvent) => void;
  /** Receives the Leaflet instance (snapshot capture, fit control). */
  onMapRef: (map: L.Map | null) => void;
  /** Desktop gets the +/- control bottom-right (same slot as the map canvas). */
  showZoom?: boolean;
  /** The selection popup, rendered inside the map context. */
  children?: React.ReactNode;
}

/**
 * Plan mode: the sheet as a first-class CANVAS (plan consensus #2).
 *
 * A second map in `L.CRS.Simple` — the official floor-plan/game-map pattern —
 * with the registered sheet as its base image and lot geometry re-projected
 * into sheet space via the registration corners. The sheet is axis-aligned by
 * construction, so no map rotation is needed (leaflet-rotate is GPL-3.0 with
 * an open touch path-rotation bug: rejected in M9).
 *
 * Layering is deliberate, using Leaflet's distinct pane slots: the basemap is
 * OFF (a neutral canvas), the plan raster owns the ground slot (tilePane,
 * z=200), lot fills the overlay slot (z=400), labels their own non-interactive
 * pane (z=620 via LotLabelsLayer), popups above (z=700).
 */
export function PlanModeCanvas({
  projectId,
  sheet,
  geometries,
  colorFor,
  selectedLotId,
  onSelect,
  onMapRef,
  showZoom = false,
  children,
}: PlanModeCanvasProps) {
  // The whole sheet, unclipped and unblended — the paper is the canvas.
  const { url, error } = usePlanOverlayImage(projectId, sheet, false, true);

  const space = useMemo(
    () =>
      sheet.cornersWgs84
        ? buildSheetSpace(sheet.cornersWgs84, sheet.imageWidth, sheet.imageHeight)
        : null,
    [sheet],
  );

  const sheetBounds = useMemo<[LatLng, LatLng]>(
    () => [
      [0, 0],
      [sheet.imageHeight, sheet.imageWidth],
    ],
    [sheet.imageHeight, sheet.imageWidth],
  );

  const transformFeature = useCallback(
    (feature: GeoJsonFeature) => (space ? featureToSheet(feature, space) : feature),
    [space],
  );

  const labelLots = useMemo<LabelLot[]>(() => {
    if (!space) return [];
    return geometries.flatMap((g) => {
      const position = featureCentroid(featureToSheet(g.geometryWgs84, space));
      return position
        ? [
            {
              lotId: g.lotId,
              lotNumber: g.lotNumber,
              status: g.status,
              chainage: chainageLabel(g.chainageStart, g.chainageEnd),
              position,
            },
          ]
        : [];
    });
  }, [geometries, space]);

  if (!space) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
        This sheet’s registration cannot be inverted — re-register it in Project Settings.
      </div>
    );
  }

  return (
    <MapContainer
      // Fresh map per sheet: `bounds` gives the fit-to-sheet opening camera.
      key={sheet.id}
      ref={onMapRef}
      crs={L.CRS.Simple}
      bounds={sheetBounds}
      // Negative zooms let a full A1 sheet fit the viewport; positive zooms
      // magnify the raster for detail reading.
      minZoom={-4}
      maxZoom={4}
      zoomSnap={0.25}
      zoomControl={false}
      attributionControl={false}
      className="civos-plan-canvas"
      style={{ height: '100%', width: '100%' }}
    >
      {showZoom && <ZoomControl position="bottomright" />}
      {url && <ImageOverlay url={url} bounds={sheetBounds} pane="tilePane" />}
      {error && (
        <div className="absolute inset-x-0 top-1/2 z-[500] mx-auto w-fit rounded bg-background/90 px-3 py-2 text-sm text-destructive shadow">
          Could not load the sheet image.
        </div>
      )}
      <LotsGeoJsonLayer
        geometries={geometries}
        colorFor={colorFor}
        selectedLotId={selectedLotId}
        onSelect={onSelect}
        transformFeature={transformFeature}
      />
      <LotLabelsLayer
        lots={labelLots}
        colorFor={colorFor}
        selectedLotId={selectedLotId}
        // Sheet zooms are CRS.Simple (-4..4), not web-mercator: the sheet is
        // already a zoomed-in artifact, so labels start at numbers, never dots.
        tierFor={planTier}
      />
      {children}
    </MapContainer>
  );
}

export default PlanModeCanvas;

import { useCallback, useMemo, useRef } from 'react';
import { GeoJSON } from 'react-leaflet';
import L, { type PathOptions } from 'leaflet';

import type { GeoJsonFeature, ProjectLotGeometry } from './lotMapData';

// Constant dark casing for lot boundaries so the status colour lives in the fill
// only and the outline stays crisp on satellite imagery (see UX audit Q4).
export const POLYGON_STROKE_COLOR = '#1f2937';

/** What the workspace needs to know about a click on a lot shape. */
export interface LotSelectEvent {
  lotId: string;
  latlng: { lat: number; lng: number };
}

interface LotFeatureProperties {
  lotId: string;
  status: string;
}

interface LotsGeoJsonLayerProps {
  geometries: ProjectLotGeometry[];
  /**
   * Resolved fill/stroke colour for a lot — the caller owns recolours (status,
   * testing overlay, history replay) so this layer never reaches into them.
   */
  colorFor: (lotId: string, status: string) => string;
  selectedLotId: string | null;
  onSelect: (event: LotSelectEvent) => void;
  /**
   * Plan mode: map WGS84 features into sheet coordinates before rendering.
   * Identity (geographic mode) when omitted.
   */
  transformFeature?: (feature: GeoJsonFeature) => GeoJsonFeature;
  /** Leaflet pane for the shapes (plan mode's explicit lot-fills pane). */
  pane?: string;
}

/**
 * Every lot geometry as ONE Leaflet GeoJSON layer.
 *
 * This replaces ~N `<Polygon>`+`<Popup>` react-leaflet components with a single
 * component: per-feature React reconciliation was the measured bottleneck at
 * hundreds of lots (react-leaflet component overhead, not Leaflet — see the
 * M9 research: 40k features took ~30s as components vs seconds as one layer).
 *
 * Selection is lifted: clicking a shape reports `{lotId, latlng}` and the
 * caller renders the single popup. Colour changes flow through the `style`
 * callback (react-leaflet calls `layer.setStyle` on identity change), so
 * recolours never remount the layer; geometry-set changes do, via `key`.
 */
export function LotsGeoJsonLayer({
  geometries,
  colorFor,
  selectedLotId,
  onSelect,
  transformFeature,
  pane,
}: LotsGeoJsonLayerProps) {
  // Rebuilt only when the geometry set changes; `key` forces the remount that
  // react-leaflet's immutable `data` prop needs.
  const versionRef = useRef(0);
  const data = useMemo(() => {
    versionRef.current += 1;
    return {
      type: 'FeatureCollection',
      features: geometries.map((g) => {
        const feature = transformFeature ? transformFeature(g.geometryWgs84) : g.geometryWgs84;
        return {
          ...feature,
          properties: { lotId: g.lotId, status: g.status } satisfies LotFeatureProperties,
        };
      }),
    } as GeoJSON.FeatureCollection;
  }, [geometries, transformFeature]);

  const style = useCallback(
    (feature?: GeoJSON.Feature): PathOptions => {
      const props = feature?.properties as LotFeatureProperties | undefined;
      if (!props) return {};
      const color = colorFor(props.lotId, props.status);
      const selected = props.lotId === selectedLotId;
      if (feature?.geometry?.type === 'LineString') {
        // Status reaches a linear lot through its STROKE — there is no fill.
        return { color, weight: selected ? 6 : 4, opacity: 1 };
      }
      return {
        color: POLYGON_STROKE_COLOR,
        weight: selected ? 3 : 2,
        opacity: 0.9,
        fillColor: color,
        fillOpacity: selected ? 0.65 : 0.45,
      };
    },
    [colorFor, selectedLotId],
  );

  // Point lots render as the same circle marker the old per-lot layer used;
  // the shared `style` callback colours it like a polygon (casing + fill).
  const pointToLayer = useCallback(
    (_feature: GeoJSON.Feature, latlng: L.LatLng) => L.circleMarker(latlng, { radius: 7 }),
    [],
  );

  const eventHandlers = useMemo(
    () => ({
      click: (e: L.LeafletMouseEvent) => {
        const layer = (e as unknown as { propagatedFrom?: { feature?: GeoJSON.Feature } })
          .propagatedFrom;
        const props = layer?.feature?.properties as LotFeatureProperties | undefined;
        if (props) onSelect({ lotId: props.lotId, latlng: e.latlng });
      },
    }),
    [onSelect],
  );

  return (
    <GeoJSON
      key={versionRef.current}
      data={data}
      style={style}
      pointToLayer={pointToLayer}
      eventHandlers={eventHandlers}
      // Geoman must never initialise editing on the read-only lot shapes.
      pmIgnore
      {...(pane ? { pane } : {})}
    />
  );
}

export default LotsGeoJsonLayer;

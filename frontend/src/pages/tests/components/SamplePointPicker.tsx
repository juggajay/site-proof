import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import { useEffect, useMemo } from 'react';

import { useLotGeometries } from '@/pages/lots/map/lotMapData';
import {
  AU_DEFAULT_CENTER,
  AU_DEFAULT_ZOOM,
  computeBounds,
  featureToShape,
  type LatLng,
} from '@/pages/lots/map/lotMapHelpers';

/**
 * Wave C3 Phase B2. Tap a point; that is where the sample was taken.
 *
 * Lazy-loaded by the capture control (`React.lazy`) so Leaflet never enters the
 * test-register bundle — the same reason `LotsPage` lazy-loads `LotMapView`.
 *
 * The linked lot's geometry is drawn and fitted as ORIENTATION ONLY. It is never
 * a pin: the lot outline being on screen is what makes a human tap meaningful,
 * and its centroid is exactly the fabricated location `[C3S-B1]` forbids. There
 * is no default marker — no pick, no point.
 */
const PICKED_ICON = L.divIcon({
  className: 'siteproof-sample-pick',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: '<div style="width:22px;height:22px;border-radius:9999px;background:#db2777;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>',
});

const LOT_OUTLINE_COLOR = '#1f2937';

function FitLot({ bounds }: { bounds: [LatLng, LatLng] | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [16, 16], maxZoom: 19 });
  }, [map, bounds]);
  return null;
}

function ClickCapture({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export interface SamplePointPickerProps {
  /** The test's linked lot, for orientation. Absent → the map opens on Australia. */
  lotId?: string;
  /** The point picked so far, or null. */
  value: { lat: number; lng: number } | null;
  onPick: (lat: number, lng: number) => void;
}

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY as string | undefined;

export function SamplePointPicker({ lotId, value, onPick }: SamplePointPickerProps) {
  const geometriesQuery = useLotGeometries(lotId);
  const features = useMemo(
    () => (geometriesQuery.data?.geometries ?? []).map((g) => g.geometryWgs84),
    [geometriesQuery.data],
  );
  const bounds = useMemo(() => computeBounds(features), [features]);

  return (
    <div className="overflow-hidden rounded-md border" data-testid="sample-point-picker">
      <MapContainer
        center={AU_DEFAULT_CENTER}
        zoom={AU_DEFAULT_ZOOM}
        scrollWheelZoom
        style={{ height: 260, width: '100%' }}
      >
        {MAPTILER_KEY ? (
          <TileLayer
            url={`https://api.maptiler.com/maps/satellite/{z}/{x}/{y}.jpg?key=${MAPTILER_KEY}`}
            attribution='&copy; <a href="https://www.maptiler.com/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            maxZoom={20}
            crossOrigin="anonymous"
          />
        ) : (
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            maxZoom={19}
            crossOrigin="anonymous"
          />
        )}
        <FitLot bounds={bounds} />
        <ClickCapture onPick={onPick} />
        {features.map((feature, i) => {
          const shape = featureToShape(feature);
          if (!shape) return null;
          if (shape.kind === 'polygon') {
            return (
              <Polygon
                key={i}
                positions={shape.positions}
                pathOptions={{
                  color: LOT_OUTLINE_COLOR,
                  weight: 2,
                  fillColor: LOT_OUTLINE_COLOR,
                  fillOpacity: 0.12,
                }}
              />
            );
          }
          if (shape.kind === 'line') {
            return (
              <Polyline
                key={i}
                positions={shape.positions}
                pathOptions={{ color: LOT_OUTLINE_COLOR, weight: 4 }}
              />
            );
          }
          // A point-kind lot geometry: without this the map opens on the right
          // place showing nothing, which is worse than useless for orientation.
          return (
            <CircleMarker
              key={i}
              center={shape.position}
              radius={7}
              pathOptions={{
                color: LOT_OUTLINE_COLOR,
                weight: 2,
                fillColor: LOT_OUTLINE_COLOR,
                fillOpacity: 0.12,
              }}
            />
          );
        })}
        {value && <Marker position={[value.lat, value.lng]} icon={PICKED_ICON} />}
      </MapContainer>
    </div>
  );
}

export default SamplePointPicker;

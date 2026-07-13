import 'leaflet/dist/leaflet.css';

import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { ImageOverlay, MapContainer, Marker, Polygon, useMap, useMapEvents } from 'react-leaflet';

export interface ImagePoint {
  px: number;
  py: number;
}

interface PlanSheetImageMapProps {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  points: ImagePoint[];
  onAddPoint: (point: ImagePoint) => void;
  onMovePoint: (index: number, point: ImagePoint) => void;
  /** Draw a closed polygon through the points (perimeter mode). */
  polygon?: boolean;
}

// CRS.Simple maps LatLng (lat, lng) directly to (y, x). We place the image with
// south-west [0,0] and north-east [imageHeight, imageWidth], so leaflet `lat`
// runs 0 (image BOTTOM) → imageHeight (image TOP) and `lng` runs 0 → imageWidth
// (left → right). Image pixels use y-DOWN (0 at the top), so we convert:
//   pixel py = imageHeight - lat      lat = imageHeight - py
//   pixel px = lng                    lng = px
function latLngToPixel(latlng: L.LatLng, imageHeight: number): ImagePoint {
  return { px: latlng.lng, py: imageHeight - latlng.lat };
}
function pixelToLatLng(point: ImagePoint, imageHeight: number): L.LatLngExpression {
  return [imageHeight - point.py, point.px];
}

/** A click maps to a valid image pixel only when it lands within the sheet. */
export function isPointInImage(point: ImagePoint, width: number, height: number): boolean {
  return point.px >= 0 && point.px <= width && point.py >= 0 && point.py <= height;
}

function numberedIcon(index: number): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:9999px;background:#2563eb;color:#fff;font-size:12px;font-weight:600;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)">${index + 1}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function FitImage({ width, height }: { width: number; height: number }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds([
      [0, 0],
      [height, width],
    ]);
  }, [map, width, height]);
  return null;
}

function ClickCapture({
  imageWidth,
  imageHeight,
  onAddPoint,
}: {
  imageWidth: number;
  imageHeight: number;
  onAddPoint: (point: ImagePoint) => void;
}) {
  useMapEvents({
    click(e) {
      // Ignore clicks in the map margin outside the sheet — they map to
      // negative / out-of-range pixels that corrupt registration/perimeter.
      const point = latLngToPixel(e.latlng, imageHeight);
      if (isPointInImage(point, imageWidth, imageHeight)) onAddPoint(point);
    },
  });
  return null;
}

export function PlanSheetImageMap({
  imageUrl,
  imageWidth,
  imageHeight,
  points,
  onAddPoint,
  onMovePoint,
  polygon = false,
}: PlanSheetImageMapProps) {
  const bounds = useMemo<L.LatLngBoundsExpression>(
    () => [
      [0, 0],
      [imageHeight, imageWidth],
    ],
    [imageWidth, imageHeight],
  );

  return (
    <MapContainer
      crs={L.CRS.Simple}
      bounds={bounds}
      minZoom={-5}
      maxZoom={5}
      style={{ height: '100%', width: '100%', background: '#1f2937' }}
      data-testid="plan-sheet-map"
    >
      <ImageOverlay url={imageUrl} bounds={bounds} />
      <FitImage width={imageWidth} height={imageHeight} />
      <ClickCapture imageWidth={imageWidth} imageHeight={imageHeight} onAddPoint={onAddPoint} />
      {polygon && points.length >= 2 && (
        <Polygon
          positions={points.map((point) => pixelToLatLng(point, imageHeight))}
          pathOptions={{ color: '#2563eb', weight: 2, fillColor: '#2563eb', fillOpacity: 0.15 }}
        />
      )}
      {points.map((point, index) => (
        <Marker
          key={index}
          position={pixelToLatLng(point, imageHeight)}
          icon={numberedIcon(index)}
          draggable
          eventHandlers={{
            dragend(e) {
              const marker = e.target as L.Marker;
              onMovePoint(index, latLngToPixel(marker.getLatLng(), imageHeight));
            },
          }}
        />
      ))}
    </MapContainer>
  );
}

export default PlanSheetImageMap;

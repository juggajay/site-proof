import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

import { cornersToBounds, type SearchBounds } from './lotMapHelpers';

interface AreaDrawLayerProps {
  active: boolean;
  onComplete: (bounds: SearchBounds) => void;
}

const RECT_STYLE: L.PathOptions = {
  color: '#2563eb',
  weight: 2,
  fillColor: '#2563eb',
  fillOpacity: 0.1,
  dashArray: '5 4',
};

// While armed: crosshair cursor, dragging disabled, pointer-drag draws a live
// rubber-band rectangle (imperative L.Rectangle). On release, reports the box as
// WGS84 bounds. A trivial click (no drag) is ignored. Cleans up fully on disarm.
export function AreaDrawLayer({ active, onComplete }: AreaDrawLayerProps) {
  const map = useMap();
  const startRef = useRef<L.LatLng | null>(null);
  const rectRef = useRef<L.Rectangle | null>(null);

  useEffect(() => {
    if (!active) return;

    const container = map.getContainer();
    const previousCursor = container.style.cursor;
    container.style.cursor = 'crosshair';
    map.dragging.disable();

    const clearRect = () => {
      if (rectRef.current) {
        rectRef.current.remove();
        rectRef.current = null;
      }
    };

    const onDown = (e: L.LeafletMouseEvent) => {
      startRef.current = e.latlng;
      clearRect();
    };

    const onMove = (e: L.LeafletMouseEvent) => {
      if (!startRef.current) return;
      const bounds = L.latLngBounds(startRef.current, e.latlng);
      if (rectRef.current) {
        rectRef.current.setBounds(bounds);
      } else {
        rectRef.current = L.rectangle(bounds, RECT_STYLE).addTo(map);
      }
    };

    const onUp = (e: L.LeafletMouseEvent) => {
      const start = startRef.current;
      startRef.current = null;
      if (!start) return;
      const bounds = cornersToBounds(start, e.latlng);
      // Ignore a bare click with no meaningful drag.
      if (bounds.east - bounds.west < 1e-9 || bounds.north - bounds.south < 1e-9) return;
      onComplete(bounds);
    };

    map.on('mousedown', onDown);
    map.on('mousemove', onMove);
    map.on('mouseup', onUp);

    return () => {
      map.off('mousedown', onDown);
      map.off('mousemove', onMove);
      map.off('mouseup', onUp);
      container.style.cursor = previousCursor;
      map.dragging.enable();
      startRef.current = null;
      clearRect();
    };
  }, [active, map, onComplete]);

  return null;
}

export default AreaDrawLayer;

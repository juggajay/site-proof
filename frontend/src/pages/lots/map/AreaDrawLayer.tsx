import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

import { boundsHasArea, cornersToBounds, type SearchBounds } from './lotMapHelpers';

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

// While armed: crosshair cursor, map dragging disabled, and a pointer drag draws
// a live rubber-band rectangle (imperative L.Rectangle). On release, reports the
// box as WGS84 bounds. Uses DOM Pointer Events on the map container so it works
// for mouse, touch and pen alike (Leaflet's mouse* events don't cover an iPad's
// touch drag once dragging is disabled). A bare tap (no drag) is ignored. Cleans
// up fully on disarm.
export function AreaDrawLayer({ active, onComplete }: AreaDrawLayerProps) {
  const map = useMap();
  const startRef = useRef<L.LatLng | null>(null);
  const rectRef = useRef<L.Rectangle | null>(null);

  useEffect(() => {
    if (!active) return;

    const container = map.getContainer();
    const previousCursor = container.style.cursor;
    const previousTouchAction = container.style.touchAction;
    container.style.cursor = 'crosshair';
    // Stop the browser panning/zooming the page under the finger while drawing.
    container.style.touchAction = 'none';
    map.dragging.disable();

    const clearRect = () => {
      if (rectRef.current) {
        rectRef.current.remove();
        rectRef.current = null;
      }
    };

    const onDown = (e: PointerEvent) => {
      // Only the primary button/contact draws; ignore secondary/right buttons.
      if (e.button != null && e.button > 0) return;
      startRef.current = map.mouseEventToLatLng(e);
      clearRect();
      try {
        container.setPointerCapture(e.pointerId);
      } catch {
        // setPointerCapture can throw if the pointer is already gone — ignore.
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!startRef.current) return;
      e.preventDefault();
      const bounds = L.latLngBounds(startRef.current, map.mouseEventToLatLng(e));
      if (rectRef.current) {
        rectRef.current.setBounds(bounds);
      } else {
        rectRef.current = L.rectangle(bounds, RECT_STYLE).addTo(map);
      }
    };

    const onUp = (e: PointerEvent) => {
      const start = startRef.current;
      startRef.current = null;
      if (!start) return;
      const bounds = cornersToBounds(start, map.mouseEventToLatLng(e));
      if (!boundsHasArea(bounds)) return;
      onComplete(bounds);
    };

    const onCancel = () => {
      startRef.current = null;
      clearRect();
    };

    container.addEventListener('pointerdown', onDown);
    container.addEventListener('pointermove', onMove);
    container.addEventListener('pointerup', onUp);
    container.addEventListener('pointercancel', onCancel);

    return () => {
      container.removeEventListener('pointerdown', onDown);
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('pointerup', onUp);
      container.removeEventListener('pointercancel', onCancel);
      container.style.cursor = previousCursor;
      container.style.touchAction = previousTouchAction;
      map.dragging.enable();
      startRef.current = null;
      clearRect();
    };
  }, [active, map, onComplete]);

  return null;
}

export default AreaDrawLayer;

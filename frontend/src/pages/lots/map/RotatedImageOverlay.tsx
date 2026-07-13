import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-imageoverlay-rotated';

import type { SheetCornersWgs84 } from '@/pages/projects/settings/planSheetsData';

// [lng, lat] → Leaflet LatLng (lat, lng).
function toLatLng([lng, lat]: [number, number]): L.LatLng {
  return L.latLng(lat, lng);
}

interface RotatedImageOverlayProps {
  url: string;
  corners: SheetCornersWgs84;
  opacity: number;
}

/**
 * Places a plan-sheet image as a rotated ImageOverlay on the satellite map,
 * pinned by its three defining corners (topLeft, topRight, bottomLeft). Recreated
 * when the image or corners change; opacity updates in place; removed on unmount.
 */
export function RotatedImageOverlay({ url, corners, opacity }: RotatedImageOverlayProps) {
  const map = useMap();
  const overlayRef = useRef<L.ImageOverlayRotated | null>(null);

  useEffect(() => {
    const overlay = L.imageOverlay.rotated(
      url,
      toLatLng(corners.topLeft),
      toLatLng(corners.topRight),
      toLatLng(corners.bottomLeft),
      { opacity, interactive: false },
    );
    overlay.addTo(map);
    overlayRef.current = overlay;
    return () => {
      overlay.remove();
      overlayRef.current = null;
    };
    // opacity intentionally excluded — updated in place by the effect below so the
    // overlay is not torn down and refetched on every slider tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, url, corners.topLeft, corners.topRight, corners.bottomLeft]);

  useEffect(() => {
    overlayRef.current?.setOpacity(opacity);
  }, [opacity]);

  return null;
}

export default RotatedImageOverlay;

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
// Type-only: pulls geoman's `leaflet` module augmentation (map.pm, pm:create)
// into the type graph without emitting a runtime import — the actual library is
// loaded lazily below.
import type {} from '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';

import { logError } from '@/lib/logger';
import type { GeoJsonFeature } from './lotMapData';

interface DrawLotLayerProps {
  active: boolean;
  onComplete: (feature: GeoJsonFeature) => void;
  onCancel: () => void;
}

// geoman's init hook only attaches `map.pm` to maps created AFTER the library is
// loaded. We load it lazily (after the map already exists), so build the pm
// handler by hand when it's missing.
// ponytail: manual L.PM.Map construction is the documented bridge for post-map
// loads; drop it if geoman is ever imported before MapContainer mounts.
function ensurePm(map: L.Map): void {
  // geoman types map.pm as always-present; access it structurally so the
  // "already initialised?" check doesn't get narrowed to `never`.
  const anyMap = map as unknown as { pm?: { setGlobalOptions?: (options: object) => void } };
  if (anyMap.pm) return;
  const pmNamespace = (
    L as unknown as {
      PM?: { Map?: new (m: L.Map) => { setGlobalOptions?: (options: object) => void } };
    }
  ).PM;
  if (pmNamespace?.Map) {
    anyMap.pm = new pmNamespace.Map(map);
    anyMap.pm.setGlobalOptions?.({});
  }
}

/**
 * Arms geoman polygon drawing on the satellite map. On completion the sketch is
 * discarded (the geometry is persisted server-side and re-fetched) and handed up
 * as a GeoJSON Feature. Esc cancels. geoman is dynamically imported only while
 * armed so it stays out of the base map chunk.
 */
export function DrawLotLayer({ active, onComplete, onCancel }: DrawLotLayerProps) {
  const map = useMap();

  useEffect(() => {
    if (!active) return;
    let disposed = false;

    const handleCreate = (e: { layer: L.Layer }) => {
      const feature = (e.layer as unknown as { toGeoJSON: () => GeoJsonFeature }).toGeoJSON();
      map.removeLayer(e.layer);
      onComplete(feature);
    };

    void (async () => {
      try {
        await import('@geoman-io/leaflet-geoman-free');
        if (disposed) return;
        ensurePm(map);
        map.on('pm:create', handleCreate);
        map.pm.enableDraw('Polygon', { finishOn: 'dblclick', snappable: true });
      } catch (err) {
        logError('Failed to start lot drawing:', err);
        onCancel();
      }
    })();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      disposed = true;
      window.removeEventListener('keydown', onKey);
      map.off('pm:create', handleCreate);
      if (map.pm) {
        try {
          map.pm.disableDraw('Polygon');
        } catch {
          // draw was never enabled — nothing to disable
        }
      }
    };
  }, [active, map, onComplete, onCancel]);

  return null;
}

export default DrawLotLayer;

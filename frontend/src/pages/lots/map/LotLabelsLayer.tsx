import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

import './lotMapLabels.css';
import {
  labelTier,
  placeLabels,
  type LabelCandidate,
  type LabelTier,
  type PlacedLabel,
} from './labelTiers';
import type { LatLng } from './lotMapHelpers';

export interface LabelLot {
  lotId: string;
  lotNumber: string;
  status: string;
  /** Preformatted chainage range, or null. */
  chainage: string | null;
  /** Label anchor (centroid) in the MAP's coordinate space. */
  position: LatLng;
}

interface LotLabelsLayerProps {
  lots: LabelLot[];
  colorFor: (lotId: string, status: string) => string;
  selectedLotId: string | null;
  /** Pane name; created here with pointer-events off so labels never eat taps. */
  pane?: string;
  /** Zoom → tier. Defaults to the geographic mapping; the plan canvas overrides. */
  tierFor?: (zoom: number) => LabelTier;
}

const DEFAULT_PANE = 'civos-lot-labels';
/** Blocked lots carry a non-colour mark (consensus #4: never colour-only). */
const ATTENTION_STATUSES = new Set(['hold_point', 'ncr_raised']);

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

function labelHtml(label: PlacedLabel, color: string): string {
  const attention = ATTENTION_STATUSES.has(label.status);
  if (label.tier === 'dot') {
    const alert = attention ? '<span class="civos-lot-alert civos-lot-alert--dot">!</span>' : '';
    return `<span class="civos-lot-anchor"><span class="civos-lot-dot" style="background:${color}"></span>${alert}</span>`;
  }
  const alert = attention ? '<span class="civos-lot-alert">!</span>' : '';
  const number = `<span class="civos-lot-label-text">${alert}${escapeHtml(label.lotNumber)}</span>`;
  const detail = label.detail
    ? `<span class="civos-lot-label-detail">${escapeHtml(label.detail)}</span>`
    : '';
  return `<span class="civos-lot-anchor">${number}${detail}</span>`;
}

/**
 * Zoom-tiered, collision-pruned lot labels as imperative Leaflet markers on a
 * dedicated non-interactive pane. Imperative on purpose: labels re-place on
 * every zoom/move, and a React component per label would reintroduce exactly
 * the per-feature overhead the GeoJSON collapse removed. The pane is also one
 * Geoman never registers on (editing and declutter layers must not coexist).
 */
export function LotLabelsLayer({
  lots,
  colorFor,
  selectedLotId,
  pane = DEFAULT_PANE,
  tierFor = labelTier,
}: LotLabelsLayerProps) {
  const map = useMap();
  const groupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!map.getPane(pane)) {
      const el = map.createPane(pane);
      // Above the overlay/marker panes (400/600), below popups (700).
      el.style.zIndex = '620';
      el.style.pointerEvents = 'none';
    }
    const group = L.layerGroup([], { pane });
    group.addTo(map);
    groupRef.current = group;
    return () => {
      group.remove();
      groupRef.current = null;
    };
  }, [map, pane]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const render = () => {
      group.clearLayers();
      const viewBounds = map.getBounds().pad(0.1);
      const zoom = map.getZoom();
      const positions = new Map<string, L.LatLng>();
      const candidates: LabelCandidate[] = [];
      for (const lot of lots) {
        const latlng = L.latLng(lot.position[0], lot.position[1]);
        if (!viewBounds.contains(latlng)) continue;
        positions.set(lot.lotId, latlng);
        const point = map.latLngToContainerPoint(latlng);
        candidates.push({
          lotId: lot.lotId,
          lotNumber: lot.lotNumber,
          status: lot.status,
          chainage: lot.chainage,
          x: point.x,
          y: point.y,
        });
      }
      for (const label of placeLabels(candidates, tierFor(zoom), selectedLotId)) {
        const latlng = positions.get(label.lotId);
        if (!latlng) continue;
        const icon = L.divIcon({
          className: 'civos-lot-label-icon',
          html: labelHtml(label, colorFor(label.lotId, label.status)),
        });
        group.addLayer(L.marker(latlng, { icon, pane, interactive: false, keyboard: false }));
      }
    };

    render();
    map.on('zoomend moveend', render);
    return () => {
      map.off('zoomend moveend', render);
    };
  }, [map, lots, colorFor, selectedLotId, pane, tierFor]);

  return null;
}

export default LotLabelsLayer;

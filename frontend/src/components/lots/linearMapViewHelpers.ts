import { LOT_STATUS_OVERVIEW_ITEMS, type LotStatusKey } from '@/lib/lotStatusOverview';

export interface LinearMapLot {
  id: string;
  lotNumber: string;
  description: string | null;
  status: string;
  activityType?: string | null;
  chainageStart: number | null;
  chainageEnd: number | null;
  layer: string | null;
  areaZone: string | null;
}

// Feature #708 - Project Area for background highlighting
export interface LinearMapProjectArea {
  id: string;
  name: string;
  chainageStart: number | null;
  chainageEnd: number | null;
  colour: string | null;
}

export type LinearMapLayer = [string, LinearMapLot[]];

interface LinearMapScale {
  minChainage: number;
  maxChainage: number;
  totalRange: number;
  layers: LinearMapLayer[];
  unmappedCount: number;
}

// Okabe-Ito colour-blind-safe palette (Feature #438), keyed to the canonical
// lot statuses in lib/lotStatusOverview.ts. `darkText` marks fills too light
// for white labels.
const LOT_STATUS_MAP_COLORS: Record<LotStatusKey, { fill: string; darkText?: boolean }> = {
  not_started: { fill: '#d1d5db', darkText: true },
  in_progress: { fill: '#56B4E9', darkText: true },
  awaiting_test: { fill: '#F0E442', darkText: true },
  hold_point: { fill: '#E69F00', darkText: true },
  ncr_raised: { fill: '#D55E00' },
  completed: { fill: '#0072B2' },
  conformed: { fill: '#009E73' },
  claimed: { fill: '#CC79A7', darkText: true },
};

export const LOT_STATUS_LEGEND = LOT_STATUS_OVERVIEW_ITEMS.map((item) => ({
  key: item.key,
  label: item.label,
}));

export const getStatusColor = (status: string) =>
  LOT_STATUS_MAP_COLORS[status as LotStatusKey]?.fill ?? '#9ca3af';

export const statusUsesDarkText = (status: string) =>
  LOT_STATUS_MAP_COLORS[status as LotStatusKey]?.darkText ?? false;

// Get activity type color
export const getActivityColor = (activityType: string | null) => {
  const colors: Record<string, string> = {
    Earthworks: '#8b5cf6', // violet
    Drainage: '#3b82f6', // blue
    Pavement: '#6b7280', // gray
    Concrete: '#78716c', // stone
    Structures: '#f59e0b', // amber
    General: '#10b981', // emerald
    Landscaping: '#22c55e', // green
    Utilities: '#ef4444', // red
    Fencing: '#f97316', // orange
    Signage: '#ec4899', // pink
  };
  return colors[activityType || ''] || '#9ca3af';
};

export function getLinearMapScale(lots: LinearMapLot[]): LinearMapScale {
  const lotsWithCh = lots.filter((lot) => lot.chainageStart !== null || lot.chainageEnd !== null);
  const unmappedCount = lots.length - lotsWithCh.length;

  if (lotsWithCh.length === 0) {
    return { minChainage: 0, maxChainage: 1000, totalRange: 1000, layers: [], unmappedCount };
  }

  const chainageValues = lotsWithCh.flatMap(
    (lot) => [lot.chainageStart, lot.chainageEnd].filter((value) => value !== null) as number[],
  );
  const min = Math.min(...chainageValues);
  const max = Math.max(...chainageValues);
  const range = max - min || 1000; // Avoid division by zero

  // Group lots by layer/activity type for rows
  const layerMap = new Map<string, LinearMapLot[]>();
  lotsWithCh.forEach((lot) => {
    const layerKey = lot.activityType || lot.layer || 'Uncategorized';
    if (!layerMap.has(layerKey)) {
      layerMap.set(layerKey, []);
    }
    layerMap.get(layerKey)!.push(lot);
  });

  return {
    minChainage: min,
    maxChainage: max,
    totalRange: range,
    layers: Array.from(layerMap.entries()).sort((a, b) => a[0].localeCompare(b[0])),
    unmappedCount,
  };
}

export interface PositionedLot {
  lot: LinearMapLot;
  start: number;
  end: number;
  lane: number;
}

// Lots in the same row with overlapping chainage stack into separate lanes
// (interval scheduling) instead of rendering on top of each other — e.g.
// subgrade over basecourse at the same chainage, or lots either side of the
// centreline.
export function assignLanes(lots: LinearMapLot[]): {
  positioned: PositionedLot[];
  laneCount: number;
} {
  const items = lots
    .map((lot) => {
      const a = lot.chainageStart ?? lot.chainageEnd ?? 0;
      const b = lot.chainageEnd ?? lot.chainageStart ?? 0;
      return { lot, start: Math.min(a, b), end: Math.max(a, b) };
    })
    .sort((x, y) => x.start - y.start || x.end - y.end);

  const laneEnds: number[] = [];
  const positioned = items.map((item) => {
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.end);
    } else {
      laneEnds[lane] = item.end;
    }
    return { ...item, lane };
  });

  return { positioned, laneCount: Math.max(laneEnds.length, 1) };
}

export function getChainageTicks(
  minChainage: number,
  maxChainage: number,
  totalRange: number,
): number[] {
  // Pick a "nice" interval (1/2/5 × 10^n) yielding ~10 ticks, so short jobs
  // (e.g. chainage 0-30) get a usable axis instead of one 100m tick.
  const targetTicks = 10;
  const rawInterval = totalRange / targetTicks || 1;
  const power = 10 ** Math.floor(Math.log10(rawInterval));
  const interval =
    [1, 2, 5, 10].map((m) => m * power).find((c) => totalRange / c <= targetTicks + 2) ??
    10 * power;

  const ticks: number[] = [];
  const startTick = Math.floor(minChainage / interval) * interval;
  for (let tick = startTick; tick <= maxChainage + interval; tick += interval) {
    // Trim float noise from fractional intervals (e.g. 0.5) before rendering.
    ticks.push(Number(tick.toFixed(6)));
  }
  return ticks;
}

export function getChainageX(
  chainage: number,
  minChainage: number,
  totalRange: number,
  zoomLevel: number,
  panOffset: number,
): number {
  return ((chainage - minChainage) / totalRange) * 100 * zoomLevel - panOffset;
}

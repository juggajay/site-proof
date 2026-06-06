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
}

// Get color based on lot status
export const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    active: '#3b82f6', // blue-500
    in_progress: '#f59e0b', // amber-500
    completed: '#22c55e', // green-500
    approved: '#10b981', // emerald-500
    on_hold: '#ef4444', // red-500
    cancelled: '#6b7280', // gray-500
    pending: '#8b5cf6', // violet-500
  };
  return colors[status] || '#9ca3af'; // gray-400 default
};

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

  if (lotsWithCh.length === 0) {
    return { minChainage: 0, maxChainage: 1000, totalRange: 1000, layers: [] };
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
  };
}

export function getChainageTicks(
  minChainage: number,
  maxChainage: number,
  totalRange: number,
): number[] {
  const tickCount = 10;
  const interval = totalRange / tickCount;
  const roundedInterval = Math.ceil(interval / 100) * 100 || 100; // Round to nearest 100
  const ticks: number[] = [];
  const startTick = Math.floor(minChainage / roundedInterval) * roundedInterval;
  for (let i = startTick; i <= maxChainage + roundedInterval; i += roundedInterval) {
    ticks.push(i);
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

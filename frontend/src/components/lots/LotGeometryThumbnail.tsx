import { getStatusColor } from '@/components/lots/linearMapViewHelpers';
import { geometryToSvgPath } from '@/pages/lots/map/geometrySvg';
import { useLotGeometries } from '@/pages/lots/map/lotMapData';

interface LotGeometryThumbnailProps {
  lotId: string;
  /** Canonical lot status for the stroke colour; falls back to neutral grey. */
  status?: string;
  size?: number;
}

function formatMeasure(areaM2: number | null, lengthM: number | null): string | null {
  const parts: string[] = [];
  if (areaM2 != null) parts.push(`${Math.round(areaM2).toLocaleString()} m²`);
  if (lengthM != null) parts.push(`${Math.round(lengthM).toLocaleString()} m`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * Small static SVG of a lot's geometry (no map tiles) — spatial context for a
 * test result. Renders nothing (not an empty box) when the lot has no geometry,
 * so it is safe to drop in unconditionally wherever a lotId is known.
 */
export function LotGeometryThumbnail({ lotId, status, size = 132 }: LotGeometryThumbnailProps) {
  const { data } = useLotGeometries(lotId);
  const geometry = data?.geometries?.[0];
  const svg = geometry ? geometryToSvgPath(geometry.geometryWgs84, { size }) : null;
  if (!geometry || !svg) return null;

  const color = getStatusColor(status ?? '');
  const measure = formatMeasure(geometry.areaM2, geometry.lengthM);
  const chainage =
    geometry.chainageStart != null && geometry.chainageEnd != null
      ? `Ch ${geometry.chainageStart}–${geometry.chainageEnd}`
      : geometry.chainageStart != null
        ? `Ch ${geometry.chainageStart}`
        : null;
  const caption = [chainage, measure].filter(Boolean).join('  ·  ');

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border bg-muted/20 p-3">
      <svg
        viewBox={svg.viewBox}
        width={size / 2}
        height={size / 2}
        role="img"
        aria-label="Lot location"
        className="shrink-0"
      >
        {svg.kind === 'point' ? (
          <circle cx={svg.point!.x} cy={svg.point!.y} r={5} fill={color} />
        ) : (
          <path
            d={svg.d}
            fill={svg.kind === 'polygon' ? color : 'none'}
            fillOpacity={svg.kind === 'polygon' ? 0.35 : undefined}
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        )}
      </svg>
      <div className="min-w-0 text-xs text-muted-foreground">
        <div className="font-medium text-foreground">Lot location</div>
        {caption && <div className="mt-0.5">{caption}</div>}
      </div>
    </div>
  );
}

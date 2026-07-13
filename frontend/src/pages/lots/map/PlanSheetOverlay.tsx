import type { PlanSheetListItem } from '@/pages/projects/settings/planSheetsData';
import { RotatedImageOverlay } from './RotatedImageOverlay';
import { usePlanOverlayImage } from './usePlanOverlayImage';

interface PlanSheetOverlayProps {
  projectId: string;
  sheet: PlanSheetListItem;
  opacity: number;
  blend: boolean;
}

/**
 * One shown plan sheet as a georeferenced overlay: fetches (and perimeter-clips /
 * white-keys) the image, then places it via the rotated ImageOverlay. Renders
 * nothing until the image is ready or if the sheet lacks registration corners.
 */
export function PlanSheetOverlay({ projectId, sheet, opacity, blend }: PlanSheetOverlayProps) {
  const { url } = usePlanOverlayImage(projectId, sheet, blend);
  if (!sheet.cornersWgs84 || !url) return null;
  return <RotatedImageOverlay url={url} corners={sheet.cornersWgs84} opacity={opacity} />;
}

export default PlanSheetOverlay;

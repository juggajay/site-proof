import { useEffect, useState } from 'react';

import { authFetch } from '@/lib/api';
import { logError } from '@/lib/logger';
import type { PlanSheetListItem } from '@/pages/projects/settings/planSheetsData';
import { clipImageToPerimeter, whiteToAlpha } from './clipImageToPerimeter';

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

function drawImageToCanvas(
  source: CanvasImageSource,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')?.drawImage(source, 0, 0, width, height);
  return canvas;
}

/** Key the sheet's paper white to transparent in place on an existing canvas. */
function blendWhiteToAlpha(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  whiteToAlpha(imageData.data);
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Loads a plan-sheet image as an object URL for map overlay. Clips it to the
 * stored perimeter ring when the sheet has one, and — when `blend` is set —
 * keys the paper white to transparent so only the linework overlays the map.
 * Same authenticated-fetch pattern as usePlanSheetImage; the (possibly
 * processed) object URL is revoked on unmount / sheet change / option change.
 */
export function usePlanOverlayImage(
  projectId: string | undefined,
  sheet: PlanSheetListItem,
  blend: boolean,
): { url: string | null; error: boolean } {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const perimeter = sheet.perimeter;
  const { id: sheetId, imageWidth, imageHeight } = sheet;

  useEffect(() => {
    if (!projectId) {
      setUrl(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setUrl(null);
    setError(false);

    void (async () => {
      try {
        const response = await authFetch(
          `/api/projects/${encodeURIComponent(projectId)}/plan-sheets/${encodeURIComponent(
            sheetId,
          )}/image`,
        );
        if (!response.ok) throw new Error(`Image request failed (${response.status})`);
        const blob = await response.blob();
        if (cancelled) return;

        const hasPerimeter = Boolean(perimeter && perimeter.length >= 3);
        if (hasPerimeter || blend) {
          const bitmap = await createImageBitmap(blob);
          if (cancelled) {
            bitmap.close();
            return;
          }
          const canvas =
            hasPerimeter && perimeter
              ? clipImageToPerimeter(bitmap, imageWidth, imageHeight, perimeter)
              : drawImageToCanvas(bitmap, imageWidth, imageHeight);
          bitmap.close();
          if (blend) blendWhiteToAlpha(canvas);
          const processed = await canvasToBlob(canvas);
          if (cancelled) return;
          if (!processed) throw new Error('Could not process the plan sheet overlay');
          objectUrl = URL.createObjectURL(processed);
        } else {
          objectUrl = URL.createObjectURL(blob);
        }

        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setUrl(objectUrl);
      } catch (err) {
        logError('Failed to load plan overlay image:', err);
        if (!cancelled) setError(true);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [projectId, sheetId, imageWidth, imageHeight, perimeter, blend]);

  return { url, error };
}

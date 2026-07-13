import { useEffect, useState } from 'react';

import { authFetch } from '@/lib/api';
import { logError } from '@/lib/logger';
import type { PlanSheetListItem } from '@/pages/projects/settings/planSheetsData';
import { clipImageToPerimeter } from './clipImageToPerimeter';

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/**
 * Loads a plan-sheet image as an object URL for map overlay, clipping it to the
 * stored perimeter ring when the sheet has one. Same authenticated-fetch pattern
 * as usePlanSheetImage; the (possibly clipped) object URL is revoked on unmount /
 * sheet change.
 */
export function usePlanOverlayImage(
  projectId: string | undefined,
  sheet: PlanSheetListItem,
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

        if (perimeter && perimeter.length >= 3) {
          const bitmap = await createImageBitmap(blob);
          if (cancelled) {
            bitmap.close();
            return;
          }
          const canvas = clipImageToPerimeter(bitmap, imageWidth, imageHeight, perimeter);
          bitmap.close();
          const clipped = await canvasToBlob(canvas);
          if (cancelled) return;
          if (!clipped) throw new Error('Could not clip the plan sheet to its perimeter');
          objectUrl = URL.createObjectURL(clipped);
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
  }, [projectId, sheetId, imageWidth, imageHeight, perimeter]);

  return { url, error };
}

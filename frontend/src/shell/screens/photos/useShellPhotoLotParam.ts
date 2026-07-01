/**
 * useShellPhotoLotParam — read the optional ?lotId= query param for /m/photos.
 *
 * The lot hub's Photos tile deep-links here scoped to one lot. Keeping it as a
 * query param lets the same photo register serve both the project-wide view and
 * the lot-scoped view.
 */
import { useSearchParams } from 'react-router-dom';

export function useShellPhotoLotParam(): string | null {
  const [params] = useSearchParams();
  const lotId = params.get('lotId');
  return lotId && lotId.trim() ? lotId : null;
}

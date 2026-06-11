/**
 * useShellDocLotParam — read the optional ?lotId= query param for /m/docs.
 *
 * The lot hub's Drawings tile may deep-link here scoped to a lot. We read it from
 * the query string (not a path param) so the same flat /m/docs list route serves
 * both the project-wide entry and the lot-scoped entry. Returns null when absent.
 *
 * Tiny wrapper so the screen doesn't reach into useSearchParams with the same key
 * (mirrors useShellPhotoParam / useShellNcrParam / useShellLotParam).
 */
import { useSearchParams } from 'react-router-dom';

export function useShellDocLotParam(): string | null {
  const [params] = useSearchParams();
  const lotId = params.get('lotId');
  return lotId && lotId.trim() ? lotId : null;
}

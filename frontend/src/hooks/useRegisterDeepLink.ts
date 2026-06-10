import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from '@/components/ui/toaster';

/** How long the deep-linked row stays highlighted (matches the lot readiness pulse). */
const HIGHLIGHT_DURATION_MS = 3000;

interface UseRegisterDeepLinkOptions<T> {
  /** Query-string key carrying the record id (e.g. 'ncr', 'hp'). */
  param: string;
  /**
   * True while the register has not loaded yet (still fetching, or the fetch
   * failed). The param is only handled once real data has arrived, so a slow
   * load never produces a false "not found".
   */
  loading: boolean;
  /** The full loaded register (unfiltered), so links survive active filters. */
  records: T[];
  getRecordId: (record: T) => string;
  /** Toast copy shown when the id isn't in the register (bad id, wrong project, deleted). */
  notFound: { title: string; description: string };
}

interface UseRegisterDeepLinkReturn {
  /**
   * Id of the deep-linked record once it has been located, cleared again after
   * a short highlight pulse. Pages pass this to their list/table components to
   * scroll to and highlight the row.
   */
  highlightedId: string | null;
}

/**
 * Read side of the register "Copy link" actions (`?ncr=<id>` on the NCR
 * register, `?hp=<id>` on the hold-point register): once the register data has
 * loaded, locate the linked record and surface it, or show a non-blocking
 * "couldn't find that record" toast. Either way the param is removed from the
 * URL (replace navigation) so a refresh doesn't re-trigger the handling.
 */
export function useRegisterDeepLink<T>({
  param,
  loading,
  records,
  getRecordId,
  notFound,
}: UseRegisterDeepLinkOptions<T>): UseRegisterDeepLinkReturn {
  const [searchParams, setSearchParams] = useSearchParams();
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  // One-shot guard per param value: data refreshes (e.g. polling) re-run the
  // effect before the cleared param lands in the router state.
  const handledIdRef = useRef<string | null>(null);

  useEffect(() => {
    const linkedId = searchParams.get(param);
    if (!linkedId) {
      handledIdRef.current = null;
      return;
    }
    if (loading || handledIdRef.current === linkedId) return;
    handledIdRef.current = linkedId;

    if (records.some((record) => getRecordId(record) === linkedId)) {
      setHighlightedId(linkedId);
    } else {
      toast({ title: notFound.title, description: notFound.description, variant: 'error' });
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete(param);
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams, param, loading, records, getRecordId, notFound]);

  useEffect(() => {
    if (!highlightedId) return;
    const timeout = window.setTimeout(() => setHighlightedId(null), HIGHLIGHT_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [highlightedId]);

  return { highlightedId };
}

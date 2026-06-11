/**
 * useDocFileOpen — open a drawing FILE full-screen, reusing the EXISTING idiom.
 *
 * Viewer decision (PR-7 rule 1): there is no DocumentViewerModal in the codebase;
 * the strongest existing path for opening a drawing file is the signed-URL idiom
 * the desktop Drawing Register already uses — `openDocumentAccessUrl(documentId,
 * fileUrl)` (lib/documentAccess). It mints a short-lived signed URL via
 * POST /api/documents/:id/signed-url and opens it in a new tab, where the phone's
 * native PDF/image viewer gives full-screen view + pinch-zoom/pan for free. We
 * reuse it verbatim — fastest path to "current revision, open it" (research 13),
 * VIEW-only (research 14): no upload/revision/supersede affordances anywhere.
 *
 * On failure we surface the same toast the desktop page uses, so the foreman gets
 * an honest "couldn't open" rather than a silent no-op.
 */
import { useCallback, useState } from 'react';
import { openDocumentAccessUrl } from '@/lib/documentAccess';
import { extractErrorMessage } from '@/lib/errorHandling';
import { toast } from '@/components/ui/toaster';
import { logError } from '@/lib/logger';

export interface DocFileOpener {
  /** True while a signed URL is being minted for an open request. */
  opening: boolean;
  /** Open the drawing file full-screen via the existing signed-URL idiom. */
  openDoc: (documentId: string, fileUrl: string) => Promise<void>;
}

export function useDocFileOpen(): DocFileOpener {
  const [opening, setOpening] = useState(false);

  const openDoc = useCallback(async (documentId: string, fileUrl: string) => {
    setOpening(true);
    try {
      await openDocumentAccessUrl(documentId, fileUrl);
    } catch (err) {
      logError('Error opening drawing:', err);
      toast({
        title: 'Could not open drawing',
        description: extractErrorMessage(err, 'Failed to open drawing. Please try again.'),
        variant: 'error',
      });
    } finally {
      setOpening(false);
    }
  }, []);

  return { opening, openDoc };
}

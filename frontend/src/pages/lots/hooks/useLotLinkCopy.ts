// The lot detail copy-link workflow, moved verbatim from LotDetailPage.tsx:
// shareable-URL construction, the async clipboard write with the legacy
// textarea/execCommand fallback, the shared "Link copied!" toast, and the
// 2-second linkCopied reset that drives the header button state.

import { useState } from 'react';
import { toast } from '@/components/ui/toaster';

interface UseLotLinkCopyOptions {
  projectId: string | undefined;
  lotId: string | undefined;
}

export function useLotLinkCopy({ projectId, lotId }: UseLotLinkCopyOptions) {
  const [linkCopied, setLinkCopied] = useState(false);

  // Copy link handler
  const copyLotLink = async () => {
    const url = `${window.location.origin}/projects/${encodeURIComponent(projectId || '')}/lots/${encodeURIComponent(lotId || '')}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      toast({
        title: 'Link copied!',
        description: 'The lot link has been copied to your clipboard.',
      });
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setLinkCopied(true);
      toast({
        title: 'Link copied!',
        description: 'The lot link has been copied to your clipboard.',
      });
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  return { linkCopied, copyLotLink };
}

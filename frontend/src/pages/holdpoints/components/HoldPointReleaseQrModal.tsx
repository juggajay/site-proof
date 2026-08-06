import { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { Copy, Loader2, QrCode } from 'lucide-react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { apiFetch } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import { generateQrSvg } from '@/lib/qrCode';
import { logError } from '@/lib/logger';

// Benchmark T2 — "have the approver scan this, or send them the link".
//
// The link opens the ordinary public release page, so the approver still reads
// the evidence package, still signs, and the release still lands in the
// register like any other. Nothing here is a shortcut around that.

interface ReleaseLinkResponse {
  releaseUrl: string;
  expiresAt: string;
  recipientEmail: string;
  recipientName: string | null;
}

interface HoldPointReleaseQrModalProps {
  holdPointId: string;
  lotNumber: string;
  description: string;
  onClose: () => void;
}

const QR_PIXEL_SIZE = 220;

function formatExpiry(expiresAt: string): string {
  const expiry = new Date(expiresAt);
  if (!Number.isFinite(expiry.getTime())) return 'shortly';
  const minutes = Math.max(1, Math.round((expiry.getTime() - Date.now()) / 60_000));
  return `in ${minutes} minute${minutes === 1 ? '' : 's'}`;
}

export function HoldPointReleaseQrModal({
  holdPointId,
  lotNumber,
  description,
  onClose,
}: HoldPointReleaseQrModalProps) {
  const [link, setLink] = useState<ReleaseLinkResponse | null>(null);
  const [qrSvg, setQrSvg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function mintLink() {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch<ReleaseLinkResponse>(
          `/api/holdpoints/${encodeURIComponent(holdPointId)}/release-link`,
          { method: 'POST', body: JSON.stringify({}) },
        );
        const svg = await generateQrSvg(response.releaseUrl, QR_PIXEL_SIZE);
        if (!cancelled) {
          setLink(response);
          setQrSvg(svg);
        }
      } catch (err) {
        logError('Failed to create hold point release link:', err);
        if (!cancelled) {
          setError(
            extractErrorMessage(err, 'Could not create a release link for this hold point.'),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void mintLink();

    return () => {
      cancelled = true;
    };
  }, [holdPointId]);

  const handleCopyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.releaseUrl);
      toast({ title: 'Link copied', description: 'Send it to the approver however suits.' });
    } catch {
      toast({
        title: 'Could not copy the link',
        description: 'Select the address below and copy it manually.',
        variant: 'warning',
      });
    }
  };

  return (
    <Modal onClose={onClose} className="max-w-sm">
      <ModalHeader>
        <span className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-primary" />
          Release by QR code
        </span>
      </ModalHeader>

      <ModalBody>
        <p className="text-sm text-muted-foreground">
          Have the approver scan this, or send them the link.
        </p>
        <p className="mt-1 text-sm font-medium">
          {lotNumber} - {description}
        </p>

        <div className="mt-4 flex flex-col items-center">
          {loading ? (
            <div
              className="flex h-[220px] w-[220px] items-center justify-center text-muted-foreground"
              role="status"
              aria-label="Creating release link"
            >
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : error ? (
            <div
              className="w-full rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {error}
            </div>
          ) : (
            <>
              <div className="rounded-lg border bg-white p-4">
                <div
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(qrSvg) }}
                  style={{ width: QR_PIXEL_SIZE, height: QR_PIXEL_SIZE }}
                />
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Records the release as{' '}
                <span className="font-medium text-foreground">
                  {link?.recipientName || link?.recipientEmail}
                </span>
                , the authority this release was requested from.
              </p>
              <p className="mt-1 text-center text-xs text-muted-foreground">
                This link expires {link ? formatExpiry(link.expiresAt) : 'shortly'} and can be used
                once.
              </p>
              <p className="mt-2 break-all px-2 text-center text-[11px] text-muted-foreground">
                {link?.releaseUrl}
              </p>
            </>
          )}
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="outline" onClick={onClose} className="flex-1">
          Close
        </Button>
        <Button onClick={handleCopyLink} disabled={!link} className="flex-1">
          <Copy className="h-4 w-4" />
          Copy link
        </Button>
      </ModalFooter>
    </Modal>
  );
}

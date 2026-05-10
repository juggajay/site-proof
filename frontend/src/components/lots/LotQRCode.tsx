import { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { QrCode, Download, Printer } from 'lucide-react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { downloadBlob } from '@/lib/downloads';
import { escapeHtml, generateQrSvg } from '@/lib/qrCode';

interface LotQRCodeProps {
  lotId: string;
  lotNumber: string;
  projectId: string;
  size?: 'small' | 'medium' | 'large';
}

const sizeMap = {
  small: 32,
  medium: 64,
  large: 120,
};
const INVALID_DOWNLOAD_FILENAME_CHARS = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*']);

function sanitizeQrDownloadFilename(filename: string): string {
  const sanitized = Array.from(filename)
    .map((char) =>
      INVALID_DOWNLOAD_FILENAME_CHARS.has(char) || char.charCodeAt(0) < 32 ? '-' : char,
    )
    .join('')
    .replace(/\s+/g, ' ')
    .replace(/^[.\-\s]+/, '')
    .trim();

  const fallback = sanitized || 'qr-code.svg';
  return fallback.toLowerCase().endsWith('.svg') ? fallback : `${fallback}.svg`;
}

export function LotQRCode({ lotId, lotNumber, projectId, size = 'small' }: LotQRCodeProps) {
  const [showModal, setShowModal] = useState(false);
  const [qrSvg, setQrSvg] = useState('');
  const [modalQrSvg, setModalQrSvg] = useState('');
  const [qrError, setQrError] = useState<string | null>(null);
  const qrUrl = `${window.location.origin}/projects/${projectId}/lots/${lotId}`;
  const pixelSize = sizeMap[size];

  useEffect(() => {
    let cancelled = false;

    setQrSvg('');
    setModalQrSvg('');
    setQrError(null);

    Promise.all([generateQrSvg(qrUrl, pixelSize), generateQrSvg(qrUrl, 200)])
      .then(([inlineSvg, modalSvg]) => {
        if (!cancelled) {
          setQrSvg(inlineSvg);
          setModalQrSvg(modalSvg);
        }
      })
      .catch(() => {
        if (!cancelled) setQrError('QR unavailable');
      });

    return () => {
      cancelled = true;
    };
  }, [pixelSize, qrUrl]);

  const handlePrint = async () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: 'Popup blocked',
        description: 'Allow popups to print the QR code.',
        variant: 'warning',
      });
      return;
    }
    printWindow.opener = null;

    let printQrSvg: string;

    try {
      printQrSvg = await generateQrSvg(qrUrl, 200);
    } catch {
      toast({
        title: 'Could not generate QR code',
        description: 'Please try printing again.',
        variant: 'error',
      });
      printWindow.close();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${escapeHtml(lotNumber)}</title>
          <style>
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              font-family: Arial, sans-serif;
            }
            .qr-container {
              text-align: center;
              padding: 20px;
              border: 1px solid #ccc;
              border-radius: 8px;
            }
            .lot-number {
              font-size: 24px;
              font-weight: bold;
              margin-top: 15px;
            }
            .url {
              font-size: 10px;
              color: #666;
              margin-top: 10px;
              word-break: break-all;
              max-width: 300px;
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            ${DOMPurify.sanitize(printQrSvg)}
            <div class="lot-number">${escapeHtml(lotNumber)}</div>
            <div class="url">${escapeHtml(qrUrl)}</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  };

  const handleDownload = async () => {
    let downloadQrSvg: string;

    try {
      downloadQrSvg = await generateQrSvg(qrUrl, 300);
    } catch {
      toast({
        title: 'Could not generate QR code',
        description: 'Please try the download again.',
        variant: 'error',
      });
      return;
    }

    const safeDownloadQrSvg = DOMPurify.sanitize(downloadQrSvg);
    const blob = new Blob([safeDownloadQrSvg], { type: 'image/svg+xml' });
    downloadBlob(blob, sanitizeQrDownloadFilename(`qr-${lotNumber}.svg`), 'qr-code.svg');
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-1.5 p-1.5 rounded border hover:bg-muted/50 transition-colors"
        title="View QR Code"
      >
        {qrSvg ? (
          <div
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(qrSvg) }}
            style={{ width: pixelSize, height: pixelSize }}
          />
        ) : (
          <div
            className="flex items-center justify-center bg-white text-[8px] text-muted-foreground"
            style={{ width: pixelSize, height: pixelSize }}
          >
            {qrError ? '!' : ''}
          </div>
        )}
      </button>

      {/* QR Code Modal */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)} className="max-w-sm">
          <ModalHeader>
            <span className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              Lot QR Code
            </span>
          </ModalHeader>

          <ModalBody>
            <div className="flex flex-col items-center">
              <div className="p-4 border rounded-lg bg-white">
                {modalQrSvg ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(modalQrSvg) }}
                    style={{ width: 200, height: 200 }}
                  />
                ) : (
                  <div className="flex h-[200px] w-[200px] items-center justify-center text-sm text-muted-foreground">
                    {qrError ?? 'Generating QR'}
                  </div>
                )}
              </div>
              <p className="mt-3 font-bold text-xl">{lotNumber}</p>
              <p className="mt-1 text-xs text-muted-foreground text-center break-all px-4">
                {qrUrl}
              </p>
            </div>
          </ModalBody>

          <ModalFooter>
            <Button variant="outline" onClick={handleDownload} disabled={!qrSvg} className="flex-1">
              <Download className="h-4 w-4" />
              Download
            </Button>
            <Button onClick={handlePrint} disabled={!qrSvg} className="flex-1">
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </ModalFooter>

          <p className="mt-2 text-xs text-center text-muted-foreground pb-2">
            Scan this QR code to quickly access lot details
          </p>
        </Modal>
      )}
    </>
  );
}

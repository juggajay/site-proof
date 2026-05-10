import { useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { Printer, QrCode, Download } from 'lucide-react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { downloadBlob, sanitizeDownloadFilename } from '@/lib/downloads';
import { escapeHtml, generateQrSvg } from '@/lib/qrCode';

interface Lot {
  id: string;
  lotNumber: string;
  description: string | null;
  status: string;
  activityType?: string | null;
  chainageStart?: number | null;
  chainageEnd?: number | null;
  layer?: string | null;
  areaZone?: string | null;
}

interface PrintLabelsModalProps {
  lots: Lot[];
  projectId: string;
  projectName?: string;
  onClose: () => void;
}

function formatChainage(start: number | null | undefined, end: number | null | undefined): string {
  if (start === null || start === undefined) {
    if (end === null || end === undefined) return '';
    return `CH ${end.toFixed(3)}`;
  }
  if (end === null || end === undefined) return `CH ${start.toFixed(3)}`;
  return `CH ${start.toFixed(3)} - ${end.toFixed(3)}`;
}

function getLotQrUrl(projectId: string, lotId: string): string {
  return `${window.location.origin}/projects/${projectId}/lots/${lotId}`;
}

async function generateLotQrSvgs(
  lots: Lot[],
  projectId: string,
  size: number,
): Promise<Record<string, string>> {
  const entries = await Promise.all(
    lots.map(
      async (lot) => [lot.id, await generateQrSvg(getLotQrUrl(projectId, lot.id), size)] as const,
    ),
  );

  return Object.fromEntries(entries);
}

export function PrintLabelsModal({ lots, projectId, projectName, onClose }: PrintLabelsModalProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [qrSvgs, setQrSvgs] = useState<Record<string, string>>({});
  const [isGeneratingQrs, setIsGeneratingQrs] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);

  const allQrsReady = lots.length > 0 && lots.every((lot) => Boolean(qrSvgs[lot.id]));

  useEffect(() => {
    let cancelled = false;

    if (lots.length === 0) {
      setQrSvgs({});
      setIsGeneratingQrs(false);
      setQrError(null);
      return () => {
        cancelled = true;
      };
    }

    setIsGeneratingQrs(true);
    setQrError(null);

    generateLotQrSvgs(lots, projectId, 80)
      .then((generated) => {
        if (!cancelled) setQrSvgs(generated);
      })
      .catch(() => {
        if (!cancelled) {
          setQrSvgs({});
          setQrError('Could not generate QR codes');
        }
      })
      .finally(() => {
        if (!cancelled) setIsGeneratingQrs(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lots, projectId]);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent || !allQrsReady) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: 'Popup blocked',
        description: 'Allow popups to print lot labels.',
        variant: 'warning',
      });
      return;
    }
    printWindow.opener = null;

    const safePrintMarkup = DOMPurify.sanitize(printContent.innerHTML);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Lot Labels - ${escapeHtml(projectName || 'Project')}</title>
          <style>
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: Arial, sans-serif;
              padding: 10mm;
            }
            .labels-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 5mm;
            }
            .label {
              border: 1px solid #ccc;
              border-radius: 4px;
              padding: 3mm;
              page-break-inside: avoid;
              display: flex;
              flex-direction: column;
              align-items: center;
              text-align: center;
              min-height: 35mm;
            }
            .label-qr {
              width: 20mm;
              height: 20mm;
              margin-bottom: 2mm;
            }
            .label-qr svg {
              width: 100%;
              height: 100%;
            }
            .label-lot-number {
              font-size: 12pt;
              font-weight: bold;
              margin-bottom: 1mm;
            }
            .label-project {
              font-size: 8pt;
              color: #666;
              margin-bottom: 1mm;
            }
            .label-details {
              font-size: 7pt;
              color: #888;
            }
            @media print {
              body {
                padding: 5mm;
              }
              .labels-grid {
                gap: 3mm;
              }
            }
          </style>
        </head>
        <body>
          ${safePrintMarkup}
        </body>
      </html>
    `);
    printWindow.document.close();

    // Wait for content to load then print
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleDownloadSVGs = async () => {
    let downloadQrSvgs: Record<string, string>;

    try {
      downloadQrSvgs = await generateLotQrSvgs(lots, projectId, 150);
    } catch {
      toast({
        title: 'Could not generate QR codes',
        description: 'Please try the download again.',
        variant: 'error',
      });
      return;
    }

    const blob = new Blob(
      [
        `
      <!DOCTYPE html>
      <html>
        <head><title>QR Codes - ${escapeHtml(projectName || 'Project')}</title></head>
        <body style="display: flex; flex-wrap: wrap; gap: 20px; padding: 20px;">
          ${lots
            .map((lot) => {
              return `
              <div style="text-align: center; border: 1px solid #ccc; padding: 10px; border-radius: 8px;">
                ${DOMPurify.sanitize(downloadQrSvgs[lot.id] ?? '')}
                <p style="font-weight: bold; margin-top: 10px;">${escapeHtml(lot.lotNumber)}</p>
              </div>
            `;
            })
            .join('')}
        </body>
      </html>
    `,
      ],
      { type: 'text/html' },
    );

    downloadBlob(
      blob,
      sanitizeDownloadFilename(`lot-labels-${projectId}.html`, 'lot-labels.html'),
      'lot-labels.html',
    );
  };

  return (
    <Modal onClose={onClose} className="max-w-4xl">
      <ModalHeader>
        <span className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-primary" />
          Print Lot Labels
          <span className="text-sm font-normal text-muted-foreground">({lots.length} labels)</span>
        </span>
      </ModalHeader>

      <ModalBody className="p-0">
        {/* Preview */}
        <div className="overflow-auto p-4 bg-muted rounded">
          <div
            ref={printRef}
            className="labels-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              backgroundColor: 'white',
              padding: '16px',
              borderRadius: '8px',
            }}
          >
            {lots.map((lot) => {
              const qrSvg = qrSvgs[lot.id];

              return (
                <div
                  key={lot.id}
                  className="label"
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    backgroundColor: 'white',
                  }}
                >
                  <div
                    className="label-qr"
                    style={{ width: '80px', height: '80px', marginBottom: '8px' }}
                  >
                    {qrSvg ? (
                      <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(qrSvg) }} />
                    ) : (
                      <div
                        style={{
                          width: '80px',
                          height: '80px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid #e5e7eb',
                          color: '#6b7280',
                          fontSize: '10px',
                        }}
                      >
                        QR
                      </div>
                    )}
                  </div>
                  <div
                    className="label-lot-number"
                    style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}
                  >
                    {lot.lotNumber}
                  </div>
                  {projectName && (
                    <div
                      className="label-project"
                      style={{ fontSize: '10px', color: '#6b7280', marginBottom: '4px' }}
                    >
                      {projectName}
                    </div>
                  )}
                  <div className="label-details" style={{ fontSize: '9px', color: '#9ca3af' }}>
                    {lot.activityType && <div>{lot.activityType}</div>}
                    {formatChainage(lot.chainageStart, lot.chainageEnd) && (
                      <div>{formatChainage(lot.chainageStart, lot.chainageEnd)}</div>
                    )}
                    {lot.layer && <div>Layer: {lot.layer}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </ModalBody>

      <ModalFooter>
        <p className="text-sm text-muted-foreground mr-auto">
          {qrError ?? 'Labels include QR codes that link to lot details'}
        </p>
        <Button
          variant="outline"
          onClick={handleDownloadSVGs}
          disabled={!allQrsReady || isGeneratingQrs}
        >
          <Download className="h-4 w-4" />
          Download
        </Button>
        <Button onClick={handlePrint} disabled={!allQrsReady || isGeneratingQrs}>
          <Printer className="h-4 w-4" />
          Print Labels
        </Button>
      </ModalFooter>
    </Modal>
  );
}

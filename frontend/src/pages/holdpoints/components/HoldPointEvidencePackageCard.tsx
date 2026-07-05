import { ClipboardCheck, Download, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { HPEvidencePackageData } from '@/lib/pdfGenerator';

interface HoldPointEvidencePackageCardProps {
  evidencePackage: HPEvidencePackageData;
  getDocumentUrl: (documentId: string) => string;
  onDownloadPdf: () => void;
  downloadingPdf: boolean;
  pdfError: string | null;
}

export function HoldPointEvidencePackageCard({
  evidencePackage,
  getDocumentUrl,
  onDownloadPdf,
  downloadingPdf,
  pdfError,
}: HoldPointEvidencePackageCardProps) {
  return (
    <div className="space-y-6">
      <div id="evidence-package" className="scroll-mt-4 rounded-lg border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="font-semibold">Evidence Package</h2>
            <p className="text-sm text-muted-foreground">
              Checklist, verification, test, and photo summary for this hold point.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={onDownloadPdf} disabled={downloadingPdf}>
            {downloadingPdf ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            PDF
          </Button>
        </div>
        {pdfError && (
          <div
            className="mx-5 mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {pdfError}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Item</th>
                <th className="px-5 py-3 font-medium">Completed</th>
                <th className="px-5 py-3 font-medium">Verified</th>
                <th className="px-5 py-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {evidencePackage.checklist.map((item) => (
                <tr
                  key={`${item.sequenceNumber}-${item.description}`}
                  className="border-b last:border-0"
                >
                  <td className="px-5 py-3 align-top">
                    <div className="font-medium">
                      {item.sequenceNumber}. {item.description}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.responsibleParty || '-'}
                    </div>
                  </td>
                  <td className="px-5 py-3 align-top">{item.isCompleted ? 'Yes' : 'No'}</td>
                  <td className="px-5 py-3 align-top">{item.isVerified ? 'Yes' : 'No'}</td>
                  <td className="max-w-sm px-5 py-3 align-top text-muted-foreground">
                    <div>{item.notes || '-'}</div>
                    {item.attachments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {item.attachments.map((attachment) => {
                          const documentId = attachment.documentId || attachment.id;
                          return (
                            <a
                              key={attachment.id}
                              href={getDocumentUrl(documentId)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-foreground underline-offset-2 hover:underline"
                            >
                              <Download className="h-3.5 w-3.5" />
                              {attachment.filename}
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Test Results</h2>
          </div>
          {evidencePackage.testResults.length === 0 ? (
            <p className="text-sm text-muted-foreground">No test results are linked to this lot.</p>
          ) : (
            <div className="space-y-3">
              {evidencePackage.testResults.map((test) => (
                <div key={test.id} className="border-b pb-3 last:border-0 last:pb-0">
                  <div className="font-medium">{test.testType}</div>
                  <div className="text-sm text-muted-foreground">
                    {test.passFail || 'pending'} · {test.resultValue ?? '-'} {test.resultUnit || ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Photos And Attachments</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {evidencePackage.summary.totalPhotos || 0} photo(s),{' '}
            {evidencePackage.summary.totalAttachments} checklist attachment(s).
          </p>
          <div className="mt-3 space-y-2">
            {evidencePackage.photos.slice(0, 5).map((photo) => (
              <div key={photo.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{photo.filename}</span>
                <Button asChild size="sm" variant="outline" className="h-8 shrink-0">
                  <a href={getDocumentUrl(photo.id)} target="_blank" rel="noopener noreferrer">
                    <Download className="h-3.5 w-3.5" />
                    Open
                  </a>
                </Button>
              </div>
            ))}
            {evidencePackage.photos.length > 5 && (
              <div className="text-sm text-muted-foreground">
                +{evidencePackage.photos.length - 5} more
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

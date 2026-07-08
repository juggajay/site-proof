import { FileText, Image as ImageIcon, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { openDocumentAccessUrl } from '@/lib/documentAccess';
import { logError } from '@/lib/logger';
import { toast } from '@/components/ui/toaster';
import type { VariationEvidence } from '../types';

function isImageEvidence(mimeType?: string | null) {
  return Boolean(mimeType?.toLowerCase().startsWith('image/'));
}

export function VariationEvidenceList({
  evidence,
  canRemove = false,
  onRemove,
}: {
  evidence: VariationEvidence[];
  canRemove?: boolean;
  onRemove?: (evidenceId: string) => void;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Evidence</p>
        <span className="text-xs text-muted-foreground">{evidence.length}</span>
      </div>
      {evidence.length === 0 ? (
        <p className="text-sm text-muted-foreground">No evidence uploaded yet.</p>
      ) : (
        <ul className="space-y-2">
          {evidence.map((item) => {
            const document = item.document;
            const Icon = isImageEvidence(document?.mimeType) ? ImageIcon : FileText;
            return (
              <li key={item.id} className="flex items-center gap-2">
                {document?.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      void openDocumentAccessUrl(document.id, null, {
                        disposition: 'inline',
                      }).catch((error) => {
                        logError('Failed to open variation evidence:', error);
                        toast({
                          title: 'Could not open evidence',
                          description: 'Try again or check your document access.',
                          variant: 'error',
                        });
                      });
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md border bg-background px-2.5 py-2 text-left text-sm hover:bg-muted"
                  >
                    <Icon size={16} className="flex-shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">
                      {document.filename || 'Variation evidence'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.evidenceType || 'evidence'}
                    </span>
                  </button>
                ) : (
                  <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border bg-background px-2.5 py-2 text-sm text-muted-foreground">
                    <FileText size={16} />
                    Evidence document unavailable
                  </div>
                )}
                {canRemove && onRemove && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(item.id)}
                    aria-label={`Remove ${document?.filename || 'evidence'}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

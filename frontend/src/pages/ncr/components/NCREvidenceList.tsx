import { FileText, Image as ImageIcon } from 'lucide-react';
import { openDocumentAccessUrl } from '@/lib/documentAccess';
import { toast } from '@/components/ui/toaster';
import { logError } from '@/lib/logger';
import type { NCR } from '../types';

interface NCREvidenceListProps {
  evidence: NonNullable<NCR['ncrEvidence']>;
  title?: string;
  emptyLabel?: string;
  variant?: 'panel' | 'inline';
}

function isImageEvidence(mimeType?: string | null) {
  return Boolean(mimeType?.toLowerCase().startsWith('image/'));
}

export function NCREvidenceList({
  evidence,
  title = 'Evidence',
  emptyLabel = 'No evidence uploaded yet.',
  variant = 'panel',
}: NCREvidenceListProps) {
  const wrapperClassName =
    variant === 'inline' ? 'border-t pt-3' : 'rounded-lg border bg-muted/30 p-3';

  return (
    <div className={wrapperClassName}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <span className="text-xs text-muted-foreground">{evidence.length}</span>
      </div>
      {evidence.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2">
          {evidence.map((item) => {
            const document = item.document;
            const Icon = isImageEvidence(document?.mimeType) ? ImageIcon : FileText;
            return (
              <li key={item.id}>
                {document?.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      void openDocumentAccessUrl(document.id, document.fileUrl).catch((error) => {
                        logError('Failed to open NCR evidence:', error);
                        toast({
                          title: 'Could not open evidence',
                          description: 'Try again or check your document access.',
                          variant: 'error',
                        });
                      });
                    }}
                    className="flex w-full items-center gap-2 rounded-md border bg-background px-2.5 py-2 text-left text-sm hover:bg-muted"
                  >
                    <Icon size={16} className="flex-shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">
                      {document.filename || 'NCR evidence'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.evidenceType || 'evidence'}
                    </span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-2 text-sm text-muted-foreground">
                    <FileText size={16} />
                    Evidence document unavailable
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

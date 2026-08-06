import { FileText, Image as ImageIcon } from 'lucide-react';
import { openDocumentAccessUrl } from '@/lib/documentAccess';
import { toast } from '@/components/ui/toaster';
import { logError } from '@/lib/logger';
import type { NCR } from '../types';
import { groupEvidenceByPhase } from '../ncrEvidencePhase';

type EvidenceItems = NonNullable<NCR['ncrEvidence']>;
type EvidenceItem = EvidenceItems[number];

interface NCREvidenceListProps {
  evidence: EvidenceItems;
  title?: string;
  emptyLabel?: string;
  variant?: 'panel' | 'inline';
}

function isImageEvidence(mimeType?: string | null) {
  return Boolean(mimeType?.toLowerCase().startsWith('image/'));
}

function EvidenceRow({ item }: { item: EvidenceItem }) {
  const document = item.document;

  if (!document?.id) {
    return (
      <li className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-2 text-sm text-muted-foreground">
        <FileText size={16} />
        Evidence document unavailable
      </li>
    );
  }

  const Icon = isImageEvidence(document.mimeType) ? ImageIcon : FileText;

  return (
    <li>
      <button
        type="button"
        onClick={() => {
          void openDocumentAccessUrl(document.id, document.fileUrl, {
            disposition: 'inline',
          }).catch((error) => {
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
        <span className="min-w-0 flex-1 truncate">{document.filename || 'NCR evidence'}</span>
        <span className="text-xs text-muted-foreground">{item.evidenceType || 'evidence'}</span>
      </button>
    </li>
  );
}

function EvidenceSection({
  heading,
  hint,
  items,
  emptyLabel,
}: {
  heading: string;
  hint: string;
  items: EvidenceItem[];
  emptyLabel: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {heading} <span className="normal-case tracking-normal">— {hint}</span>
      </p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((item) => (
            <EvidenceRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function NCREvidenceList({
  evidence,
  title = 'Evidence',
  emptyLabel = 'No evidence uploaded yet.',
  variant = 'panel',
}: NCREvidenceListProps) {
  const wrapperClassName =
    variant === 'inline' ? 'border-t pt-3' : 'rounded-lg border bg-muted/30 p-3';
  const { before, after, unphased } = groupEvidenceByPhase(evidence);
  // Evidence uploaded before the phase split carries no before/after tag; those
  // records keep the original flat list rather than an empty paired layout.
  const isPhased = before.length > 0 || after.length > 0;

  return (
    <div className={wrapperClassName}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <span className="text-xs text-muted-foreground">{evidence.length}</span>
      </div>
      {evidence.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : isPhased ? (
        // Stacked sections, never side-by-side rows: the record carries a phase
        // per item and no pair identifier, so a two-column layout would invent a
        // before/after correspondence that does not exist in the data.
        <div className="space-y-4">
          <EvidenceSection
            heading="Before"
            hint="the defect"
            items={before}
            emptyLabel="No before photos."
          />
          <EvidenceSection
            heading="After"
            hint="the fix"
            items={after}
            emptyLabel="No after photos yet."
          />
          {unphased.length > 0 && (
            <EvidenceSection
              heading="Other evidence"
              hint="certificates and untagged files"
              items={unphased}
              emptyLabel=""
            />
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {unphased.map((item) => (
            <EvidenceRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

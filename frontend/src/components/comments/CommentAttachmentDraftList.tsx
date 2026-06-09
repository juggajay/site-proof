import { FileText, X } from 'lucide-react';
import { type PendingAttachment } from './commentAttachmentDrafts';

interface CommentAttachmentDraftListProps {
  attachments: PendingAttachment[];
  onRemove: (index: number) => void;
}

// Pending attachments preview shown under the comment and reply composers.
export function CommentAttachmentDraftList({
  attachments,
  onRemove,
}: CommentAttachmentDraftListProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {attachments.map((att, index) => (
        <div
          key={index}
          className="relative flex items-center gap-2 p-2 bg-muted/50 rounded-lg border max-w-[180px]"
        >
          {att.preview ? (
            <img src={att.preview} alt="" className="h-8 w-8 object-cover rounded" />
          ) : (
            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
          <span className="text-xs truncate flex-1">{att.file.name}</span>
          <button
            type="button"
            onClick={() => onRemove(index)}
            aria-label={`Remove ${att.file.name}`}
            className="p-0.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

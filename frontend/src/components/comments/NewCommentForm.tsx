import { type ChangeEvent, type FormEvent, type RefObject } from 'react';
import { Paperclip, Send } from 'lucide-react';
import { CommentAttachmentDraftList } from './CommentAttachmentDraftList';
import { type PendingAttachment } from './commentAttachmentDrafts';

interface NewCommentFormProps {
  comment: string;
  submitting: boolean;
  attachments: PendingAttachment[];
  fileInputRef: RefObject<HTMLInputElement>;
  onCommentChange: (comment: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveAttachment: (index: number) => void;
}

// Top-level composer UI only. CommentsSection owns draft state, uploads, and
// mutation behavior so attachment cleanup and API contracts stay centralized.
export function NewCommentForm({
  comment,
  submitting,
  attachments,
  fileInputRef,
  onCommentChange,
  onSubmit,
  onFileSelect,
  onRemoveAttachment,
}: NewCommentFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className="relative">
        <textarea
          value={comment}
          onChange={(event) => onCommentChange(event.target.value)}
          placeholder="Add a comment... (supports **bold**, *italic*, `code`, [links](url))"
          className="w-full px-3 py-2 border rounded-lg bg-background resize-none"
          rows={3}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Supports: **bold**, *italic*, `code`, ~~strikethrough~~, [link](url), @mentions
        </p>
      </div>
      <CommentAttachmentDraftList attachments={attachments} onRemove={onRemoveAttachment} />
      <div className="flex justify-between items-center">
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={onFileSelect}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
            title="Attach file"
          >
            <Paperclip className="h-4 w-4" />
            Attach
          </button>
        </div>
        <button
          type="submit"
          disabled={!comment.trim() || submitting}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {submitting ? 'Posting...' : 'Post Comment'}
        </button>
      </div>
    </form>
  );
}

import { type ChangeEvent, type RefObject } from 'react';
import {
  CornerDownRight,
  Edit2,
  Trash2,
  X,
  Check,
  Paperclip,
  Download,
  FileText,
  Image,
} from 'lucide-react';
import { CommentAttachmentDraftList } from './CommentAttachmentDraftList';
import { type PendingAttachment } from './commentAttachmentDrafts';
import { type Comment, type CommentAttachment } from './commentsData';

// Format file size
const formatFileSize = (bytes: number | null) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Render comment content with markdown and @mentions
const renderContent = (content: string) => {
  // Process content line by line for block elements
  const lines = content.split('\n');
  let keyIndex = 0;

  const processInlineFormatting = (text: string): (string | JSX.Element)[] => {
    const result: (string | JSX.Element)[] = [];

    // Combined pattern for all inline formatting
    // Order matters: check more specific patterns first
    const patterns = [
      // Bold + Italic (***text*** or ___text___)
      {
        regex: /(\*\*\*|___)(.+?)\1/g,
        render: (_match: string, _: string, text: string) => (
          <strong key={keyIndex++} className="font-bold italic">
            {text}
          </strong>
        ),
      },
      // Bold (**text** or __text__)
      {
        regex: /(\*\*|__)(.+?)\1/g,
        render: (_match: string, _: string, text: string) => (
          <strong key={keyIndex++} className="font-semibold">
            {text}
          </strong>
        ),
      },
      // Italic (*text* or _text_)
      {
        regex: /(\*|_)(.+?)\1/g,
        render: (_match: string, _: string, text: string) => (
          <em key={keyIndex++} className="italic">
            {text}
          </em>
        ),
      },
      // Inline code (`code`)
      {
        regex: /`([^`]+)`/g,
        render: (_match: string, text: string) => (
          <code key={keyIndex++} className="px-1.5 py-0.5 bg-muted rounded text-sm font-mono">
            {text}
          </code>
        ),
      },
      // Strikethrough (~~text~~)
      {
        regex: /~~(.+?)~~/g,
        render: (_match: string, text: string) => (
          <span key={keyIndex++} className="line-through">
            {text}
          </span>
        ),
      },
      // Links ([text](url)) - only allow safe protocols
      {
        regex: /\[([^\]]+)\]\(([^)]+)\)/g,
        render: (_match: string, text: string, url: string) => {
          const trimmedUrl = url.trim();
          const isSafeUrl = /^(https?:|mailto:)/i.test(trimmedUrl);
          return isSafeUrl ? (
            <a
              key={keyIndex++}
              href={trimmedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:no-underline"
            >
              {text}
            </a>
          ) : (
            <span key={keyIndex++} className="text-muted-foreground">
              {text}
            </span>
          );
        },
      },
      // @mentions
      {
        regex: /@([\w.+-]+@[\w.-]+|[\w]+)/g,
        render: (_match: string, name: string) => (
          <span key={keyIndex++} className="text-primary font-medium bg-primary/10 px-0.5 rounded">
            @{name}
          </span>
        ),
      },
    ];

    const remaining = text;

    // Process each pattern
    for (const { regex, render } of patterns) {
      const newParts: (string | JSX.Element)[] = [];

      for (const part of result.length > 0 ? result : [remaining]) {
        if (typeof part !== 'string') {
          newParts.push(part);
          continue;
        }

        let lastIdx = 0;
        let match;
        regex.lastIndex = 0;

        while ((match = regex.exec(part)) !== null) {
          if (match.index > lastIdx) {
            newParts.push(part.slice(lastIdx, match.index));
          }
          newParts.push(render(match[0], match[1], match[2]));
          lastIdx = match.index + match[0].length;
        }

        if (lastIdx < part.length) {
          newParts.push(part.slice(lastIdx));
        } else if (lastIdx === 0) {
          newParts.push(part);
        }
      }

      if (newParts.length > 0) {
        result.length = 0;
        result.push(...newParts);
      }
    }

    return result.length > 0 ? result : [text];
  };

  const renderedLines = lines.map((line, lineIndex) => {
    // Check for code blocks (we'll handle inline code, not block for simplicity)
    const processed = processInlineFormatting(line);

    return (
      <span key={`line-${lineIndex}`}>
        {processed}
        {lineIndex < lines.length - 1 && <br />}
      </span>
    );
  });

  return <>{renderedLines}</>;
};

type CommentThreadItemProps = {
  comment: Comment;
  isReply?: boolean;
  currentUserId: string | undefined;
  editingId: string | null;
  editContent: string;
  submitting: boolean;
  replyingTo: string | null;
  replyContent: string;
  replyAttachments: PendingAttachment[];
  replyFileInputRef: RefObject<HTMLInputElement>;
  formatDate: (dateStr: string) => string;
  onStartEdit: (comment: Comment) => void;
  onCancelEdit: () => void;
  onEditContentChange: (value: string) => void;
  onUpdateComment: (commentId: string) => void;
  onRequestDelete: (commentId: string) => void;
  onReplyContentChange: (value: string) => void;
  onReplyFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveReplyAttachment: (index: number) => void;
  onClearReplyDraft: () => void;
  onBeginReply: (commentId: string) => void;
  onSubmitReply: (parentId: string) => void;
  onDownloadAttachment: (attachment: CommentAttachment) => void;
};

// Single comment card with edit mode, reply composer, attachments, and
// recursive replies. Presentation only: all state, draft handling, mutations,
// and download/origin logic stay in CommentsSection and arrive as props.
export function CommentThreadItem(props: CommentThreadItemProps) {
  const {
    comment,
    isReply = false,
    currentUserId,
    editingId,
    editContent,
    submitting,
    replyingTo,
    replyContent,
    replyAttachments,
    replyFileInputRef,
    formatDate,
    onStartEdit,
    onCancelEdit,
    onEditContentChange,
    onUpdateComment,
    onRequestDelete,
    onReplyContentChange,
    onReplyFileSelect,
    onRemoveReplyAttachment,
    onClearReplyDraft,
    onBeginReply,
    onSubmitReply,
    onDownloadAttachment,
  } = props;

  const isAuthor = currentUserId === comment.authorId;
  const isEditing = editingId === comment.id;

  // Render attachments for a comment
  const renderAttachments = (attachments?: CommentAttachment[]) => {
    if (!attachments || attachments.length === 0) return null;

    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {attachments.map((att) => {
          const isImage = att.mimeType?.startsWith('image/');
          return (
            <button
              key={att.id}
              type="button"
              onClick={() => onDownloadAttachment(att)}
              aria-label={`Download ${att.filename}`}
              className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg border hover:bg-muted transition-colors max-w-[200px] text-left"
            >
              {isImage ? (
                <Image className="h-4 w-4 text-primary flex-shrink-0" />
              ) : (
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{att.filename}</p>
                {att.fileSize && (
                  <p className="text-xs text-muted-foreground">{formatFileSize(att.fileSize)}</p>
                )}
              </div>
              <Download className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className={`${isReply ? 'ml-8 mt-3' : ''}`}>
      <div
        className={`rounded-lg border bg-card p-4 ${isReply ? 'border-l-2 border-l-primary/30' : ''}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            {comment.author.avatarUrl ? (
              <img src={comment.author.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-medium text-primary">
                  {(comment.author.fullName || comment.author.email).charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <span className="font-medium text-sm">
                {comment.author.fullName || comment.author.email}
              </span>
              <span className="text-xs text-muted-foreground ml-2">
                {formatDate(comment.createdAt)}
                {comment.isEdited && <span className="ml-1">(edited)</span>}
              </span>
            </div>
          </div>

          {isAuthor && !isEditing && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onStartEdit(comment)}
                className="p-1 text-muted-foreground hover:text-foreground rounded"
                title="Edit comment"
                aria-label="Edit comment"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onRequestDelete(comment.id)}
                className="p-1 text-muted-foreground hover:text-destructive rounded"
                title="Delete comment"
                aria-label="Delete comment"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => onEditContentChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg bg-background resize-none"
              rows={3}
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={onCancelEdit}
                className="px-3 py-1.5 text-sm border rounded-lg hover:bg-muted"
                aria-label="Cancel edit"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onUpdateComment(comment.id)}
                disabled={!editContent.trim() || submitting}
                className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
                aria-label="Save comment"
              >
                <Check className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm whitespace-pre-wrap">{renderContent(comment.content)}</p>
            {renderAttachments(comment.attachments)}
          </>
        )}

        {/* Reply Button */}
        {!isReply && !isEditing && (
          <div className="mt-3 pt-2 border-t">
            {replyingTo === comment.id ? (
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <CornerDownRight className="h-4 w-4 text-muted-foreground mt-2" />
                  <div className="flex-1 space-y-2">
                    <textarea
                      value={replyContent}
                      onChange={(e) => onReplyContentChange(e.target.value)}
                      placeholder="Write a reply..."
                      className="w-full px-3 py-2 border rounded-lg bg-background resize-none text-sm"
                      rows={2}
                      autoFocus
                    />
                    <CommentAttachmentDraftList
                      attachments={replyAttachments}
                      onRemove={onRemoveReplyAttachment}
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center ml-6">
                  <div>
                    <input
                      ref={replyFileInputRef}
                      type="file"
                      multiple
                      onChange={onReplyFileSelect}
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                    />
                    <button
                      type="button"
                      onClick={() => replyFileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                      title="Attach file"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      Attach
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={onClearReplyDraft}
                      className="px-3 py-1.5 text-sm border rounded-lg hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => onSubmitReply(comment.id)}
                      disabled={!replyContent.trim() || submitting}
                      className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
                    >
                      Reply
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onBeginReply(comment.id)}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <CornerDownRight className="h-3 w-3" />
                Reply
              </button>
            )}
          </div>
        )}
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-2">
          {comment.replies.map((reply) => (
            <CommentThreadItem key={reply.id} {...props} comment={reply} isReply />
          ))}
        </div>
      )}
    </div>
  );
}

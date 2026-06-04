import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare,
  Send,
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
import { useAuth } from '@/lib/auth';
import { apiFetch, authFetch } from '@/lib/api';
import { SUPABASE_URL } from '@/lib/config';
import { toast } from '@/components/ui/toaster';
import { devLog, logError } from '@/lib/logger';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { downloadBlob } from '@/lib/downloads';
import {
  useCommentsQuery,
  extractResponseError,
  getErrorMessage,
  type Comment,
  type CommentAttachment,
} from './commentsData';
import {
  collectAttachmentDrafts,
  removeAttachmentDraftAt,
  revokeAttachmentPreviews,
  type PendingAttachment,
} from './commentAttachmentDrafts';
import { CommentAttachmentDraftList } from './CommentAttachmentDraftList';

interface CommentsSectionProps {
  entityType: string;
  entityId: string;
}

export function CommentsSection({ entityType, entityId }: CommentsSectionProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Tracks whether the list is currently empty so a failed background poll can
  // stay silent (Feature #736) while a failed foreground load surfaces a banner.
  const hasNoCommentsRef = useRef(true);

  // Reply state
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [commentPendingDelete, setCommentPendingDelete] = useState<string | null>(null);

  // Attachment state
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [replyAttachments, setReplyAttachments] = useState<PendingAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replyFileInputRef = useRef<HTMLInputElement>(null);
  const pendingAttachmentsRef = useRef<PendingAttachment[]>([]);
  const replyAttachmentsRef = useRef<PendingAttachment[]>([]);

  const clearPendingDraft = useCallback(() => {
    revokeAttachmentPreviews(pendingAttachmentsRef.current);
    pendingAttachmentsRef.current = [];
    setPendingAttachments([]);
  }, []);

  const clearReplyDraft = useCallback(() => {
    revokeAttachmentPreviews(replyAttachmentsRef.current);
    replyAttachmentsRef.current = [];
    setReplyAttachments([]);
    setReplyContent('');
    setReplyingTo(null);
  }, []);

  const beginReply = useCallback(
    (commentId: string) => {
      if (replyingTo !== commentId) {
        revokeAttachmentPreviews(replyAttachmentsRef.current);
        replyAttachmentsRef.current = [];
        setReplyAttachments([]);
        setReplyContent('');
      }

      setReplyingTo(commentId);
    },
    [replyingTo],
  );

  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments;
  }, [pendingAttachments]);

  useEffect(() => {
    replyAttachmentsRef.current = replyAttachments;
  }, [replyAttachments]);

  useEffect(() => {
    return () => {
      revokeAttachmentPreviews(pendingAttachmentsRef.current);
      revokeAttachmentPreviews(replyAttachmentsRef.current);
    };
  }, []);

  // Feature #736: comments behave like a chat panel — fetch fresh on mount/focus
  // and poll every 15s while the tab is visible. TanStack Query's structural
  // sharing replaces the old manual "only update if changed" diff.
  const commentsQuery = useCommentsQuery(entityType, entityId, currentPage, {
    onError: (err) => {
      // A failed foreground load (nothing on screen yet) surfaces a banner; a
      // failed background poll keeps the existing list and stays silent.
      if (hasNoCommentsRef.current) {
        logError('Error fetching comments:', err);
        setError('Failed to load comments');
      } else {
        devLog('Background comments fetch failed:', err);
      }
    },
  });
  const { refetch: refetchCommentsQuery } = commentsQuery;
  const comments = commentsQuery.data?.comments ?? [];
  const pagination = commentsQuery.data?.pagination ?? null;
  const loading = commentsQuery.isLoading;

  useEffect(() => {
    hasNoCommentsRef.current = comments.length === 0;
  }, [comments.length]);

  // Keep the visible page clamped if comments were removed while viewing a later
  // page (e.g. the background poll reports a smaller page count).
  useEffect(() => {
    if (pagination && pagination.totalPages > 0 && currentPage > pagination.totalPages) {
      setCurrentPage(pagination.totalPages);
    }
  }, [pagination, currentPage]);

  const refetchComments = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['comments', entityType, entityId] });
  }, [queryClient, entityType, entityId]);

  useEffect(() => {
    clearPendingDraft();
    clearReplyDraft();
    setNewComment('');
    setEditingId(null);
    setEditContent('');
    setCommentPendingDelete(null);
    setError(null);
    setCurrentPage(1);
  }, [entityType, entityId, clearPendingDraft, clearReplyDraft]);

  // Handle file selection for main comment
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const { accepted, errors } = collectAttachmentDrafts(files);

    if (errors.length > 0) {
      toast({
        title: 'Some files could not be added',
        description: errors.join(' '),
        variant: 'error',
      });
    }

    if (accepted.length > 0) {
      setPendingAttachments((prev) => [...prev, ...accepted]);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle file selection for reply
  const handleReplyFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const { accepted, errors } = collectAttachmentDrafts(files);

    if (errors.length > 0) {
      toast({
        title: 'Some files could not be added',
        description: errors.join(' '),
        variant: 'error',
      });
    }

    if (accepted.length > 0) {
      setReplyAttachments((prev) => [...prev, ...accepted]);
    }

    // Reset input
    if (replyFileInputRef.current) {
      replyFileInputRef.current.value = '';
    }
  };

  // Remove pending attachment
  const removePendingAttachment = (index: number, isReply = false) => {
    if (isReply) {
      setReplyAttachments((prev) => removeAttachmentDraftAt(prev, index));
    } else {
      setPendingAttachments((prev) => removeAttachmentDraftAt(prev, index));
    }
  };

  const buildCommentFormData = (
    content: string,
    files: PendingAttachment[],
    parentId?: string,
  ): FormData => {
    const formData = new FormData();
    formData.append('entityType', entityType);
    formData.append('entityId', entityId);
    formData.append('content', content);
    if (parentId) {
      formData.append('parentId', parentId);
    }

    for (const { file } of files) {
      formData.append('files', file);
    }

    return formData;
  };

  const createComment = async (
    content: string,
    files: PendingAttachment[],
    parentId?: string,
  ): Promise<void> => {
    if (files.length === 0) {
      await apiFetch('/api/comments', {
        method: 'POST',
        body: JSON.stringify({
          entityType,
          entityId,
          content,
          ...(parentId ? { parentId } : {}),
        }),
      });
      return;
    }

    const response = await authFetch('/api/comments', {
      method: 'POST',
      body: buildCommentFormData(content, files, parentId),
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => '');
      throw new Error(extractResponseError(responseText, 'Failed to post comment'));
    }
  };

  // Format file size
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);

    try {
      await createComment(newComment.trim(), pendingAttachments);

      setNewComment('');
      clearPendingDraft();
      setError(null);
      setCurrentPage(1);
      await refetchComments();
    } catch (err) {
      logError('Error posting comment:', err);
      setError(getErrorMessage(err, 'Failed to post comment'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReply = async (parentId: string) => {
    if (!replyContent.trim() || submitting) return;

    setSubmitting(true);

    try {
      await createComment(replyContent.trim(), replyAttachments, parentId);

      clearReplyDraft();
      setError(null);
      await refetchComments();
    } catch (err) {
      logError('Error posting reply:', err);
      setError(getErrorMessage(err, 'Failed to post reply'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!editContent.trim() || submitting) return;

    setSubmitting(true);

    try {
      await apiFetch(`/api/comments/${commentId}`, {
        method: 'PUT',
        body: JSON.stringify({
          content: editContent.trim(),
        }),
      });

      setEditingId(null);
      setEditContent('');
      setError(null);
      await refetchComments();
    } catch (err) {
      logError('Error updating comment:', err);
      setError(getErrorMessage(err, 'Failed to update comment'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await apiFetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
      });

      setCommentPendingDelete(null);
      setError(null);
      await refetchComments();
    } catch (err) {
      logError('Error deleting comment:', err);
      setError(getErrorMessage(err, 'Failed to delete comment'));
    }
  };

  const isSupabaseCommentAttachmentUrl = (fileUrl: string) => {
    if (!/^https?:\/\//i.test(fileUrl)) return false;
    if (!SUPABASE_URL) return false;

    try {
      const url = new URL(fileUrl);
      const expectedOrigin = new URL(SUPABASE_URL).origin;
      if (url.origin !== expectedOrigin) return false;

      const pathname = decodeURIComponent(url.pathname);
      return pathname.includes('/storage/v1/object/public/') && pathname.includes('/comments/');
    } catch {
      return false;
    }
  };

  const downloadAttachment = async (attachment: CommentAttachment) => {
    try {
      if (isSupabaseCommentAttachmentUrl(attachment.fileUrl)) {
        window.open(attachment.fileUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      const response = await authFetch(`/api/comments/attachments/${attachment.id}/download`);

      if (!response.ok) {
        throw new Error('Failed to download attachment');
      }

      const blob = await response.blob();
      downloadBlob(blob, attachment.filename, 'attachment');
    } catch (err) {
      logError('Error downloading attachment:', err);
      toast({
        title: 'Download failed',
        description: 'Could not download the attachment',
        variant: 'error',
      });
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      return 'Unknown date';
    }

    return date.toLocaleString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
            <span
              key={keyIndex++}
              className="text-primary font-medium bg-primary/10 px-0.5 rounded"
            >
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
              onClick={() => void downloadAttachment(att)}
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

  const renderComment = (comment: Comment, isReply = false) => {
    const isAuthor = user?.id === comment.authorId;
    const isEditing = editingId === comment.id;

    return (
      <div key={comment.id} className={`${isReply ? 'ml-8 mt-3' : ''}`}>
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
                  onClick={() => {
                    setEditingId(comment.id);
                    setEditContent(comment.content);
                  }}
                  className="p-1 text-muted-foreground hover:text-foreground rounded"
                  title="Edit comment"
                  aria-label="Edit comment"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setCommentPendingDelete(comment.id)}
                  className="p-1 text-muted-foreground hover:text-red-600 rounded"
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
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-background resize-none"
                rows={3}
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setEditContent('');
                  }}
                  className="px-3 py-1.5 text-sm border rounded-lg hover:bg-muted"
                  aria-label="Cancel edit"
                >
                  <X className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateComment(comment.id)}
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
                        onChange={(e) => setReplyContent(e.target.value)}
                        placeholder="Write a reply..."
                        className="w-full px-3 py-2 border rounded-lg bg-background resize-none text-sm"
                        rows={2}
                        autoFocus
                      />
                      <CommentAttachmentDraftList
                        attachments={replyAttachments}
                        onRemove={(i) => removePendingAttachment(i, true)}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center ml-6">
                    <div>
                      <input
                        ref={replyFileInputRef}
                        type="file"
                        multiple
                        onChange={handleReplyFileSelect}
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
                        onClick={clearReplyDraft}
                        className="px-3 py-1.5 text-sm border rounded-lg hover:bg-muted"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSubmitReply(comment.id)}
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
                  onClick={() => beginReply(comment.id)}
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
            {comment.replies.map((reply) => renderComment(reply, true))}
          </div>
        )}
      </div>
    );
  };

  const totalCommentCount = pagination?.total ?? comments.length;
  const showingFrom =
    pagination && pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const showingTo = pagination
    ? Math.min(pagination.page * pagination.limit, pagination.total)
    : comments.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5" />
        <h3 className="font-semibold">
          Comments {totalCommentCount > 0 && `(${totalCommentCount})`}
        </h3>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
          <button
            type="button"
            onClick={() => {
              setError(null);
              void refetchCommentsQuery();
            }}
            className="ml-2 text-red-800 hover:underline"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-2 text-red-800 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* New Comment Form */}
      <form onSubmit={handleSubmitComment} className="space-y-2">
        <div className="relative">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment... (supports **bold**, *italic*, `code`, [links](url))"
            className="w-full px-3 py-2 border rounded-lg bg-background resize-none"
            rows={3}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Supports: **bold**, *italic*, `code`, ~~strikethrough~~, [link](url), @mentions
          </p>
        </div>
        <CommentAttachmentDraftList
          attachments={pendingAttachments}
          onRemove={(i) => removePendingAttachment(i, false)}
        />
        <div className="flex justify-between items-center">
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
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
            disabled={!newComment.trim() || submitting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {submitting ? 'Posting...' : 'Post Comment'}
          </button>
        </div>
      </form>

      {/* Comments List */}
      {loading ? (
        <div className="flex justify-center py-6">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No comments yet. Be the first to comment!</p>
        </div>
      ) : (
        <div className="space-y-4">{comments.map((comment) => renderComment(comment))}</div>
      )}

      {!loading && !error && pagination && pagination.totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm">
          <span className="text-muted-foreground">
            Showing {showingFrom}-{showingTo} of {pagination.total}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!pagination.hasPrevPage}
              onClick={() => {
                setError(null);
                setCurrentPage((page) => Math.max(1, page - 1));
              }}
              className="rounded-lg border px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-muted"
            >
              Previous
            </button>
            <span className="text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              type="button"
              disabled={!pagination.hasNextPage}
              onClick={() => {
                setError(null);
                setCurrentPage((page) => page + 1);
              }}
              className="rounded-lg border px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-muted"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(commentPendingDelete)}
        title="Delete Comment"
        description="This comment and any attachments will be removed. This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onCancel={() => setCommentPendingDelete(null)}
        onConfirm={() => {
          if (commentPendingDelete) void handleDeleteComment(commentPendingDelete);
        }}
      />
    </div>
  );
}

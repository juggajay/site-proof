import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Send, Paperclip } from 'lucide-react';
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
  type CommentAttachment,
} from './commentsData';
import { CommentThreadItem } from './CommentThreadItem';
import {
  collectAttachmentDrafts,
  removeAttachmentDraftAt,
  revokeAttachmentPreviews,
  type PendingAttachment,
} from './commentAttachmentDrafts';
import { CommentAttachmentDraftList } from './CommentAttachmentDraftList';
import {
  buildCommentFormData,
  formatCommentDate,
  isSupabaseCommentAttachmentUrl,
} from './commentsSectionHelpers';

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
      body: buildCommentFormData({ entityType, entityId, content, files, parentId }),
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => '');
      throw new Error(extractResponseError(responseText, 'Failed to post comment'));
    }
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

  const downloadAttachment = async (attachment: CommentAttachment) => {
    try {
      if (isSupabaseCommentAttachmentUrl(attachment.fileUrl, SUPABASE_URL)) {
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
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentThreadItem
              key={comment.id}
              comment={comment}
              currentUserId={user?.id}
              editingId={editingId}
              editContent={editContent}
              submitting={submitting}
              replyingTo={replyingTo}
              replyContent={replyContent}
              replyAttachments={replyAttachments}
              replyFileInputRef={replyFileInputRef}
              formatDate={formatCommentDate}
              onStartEdit={(target) => {
                setEditingId(target.id);
                setEditContent(target.content);
              }}
              onCancelEdit={() => {
                setEditingId(null);
                setEditContent('');
              }}
              onEditContentChange={setEditContent}
              onUpdateComment={handleUpdateComment}
              onRequestDelete={setCommentPendingDelete}
              onReplyContentChange={setReplyContent}
              onReplyFileSelect={handleReplyFileSelect}
              onRemoveReplyAttachment={(i) => removePendingAttachment(i, true)}
              onClearReplyDraft={clearReplyDraft}
              onBeginReply={beginReply}
              onSubmitReply={handleSubmitReply}
              onDownloadAttachment={(attachment) => void downloadAttachment(attachment)}
            />
          ))}
        </div>
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

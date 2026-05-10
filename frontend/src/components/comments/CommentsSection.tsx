import { useState, useEffect, useRef, useCallback } from 'react';
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
import { getAuthToken, useAuth } from '@/lib/auth';
import { apiFetch, authFetch } from '@/lib/api';
import { SUPABASE_URL } from '@/lib/config';
import { toast } from '@/components/ui/toaster';
import { devLog, logError } from '@/lib/logger';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { downloadBlob } from '@/lib/downloads';

interface CommentAuthor {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
}

interface CommentAttachment {
  id: string;
  filename: string;
  fileUrl: string;
  fileSize: number | null;
  mimeType: string | null;
  createdAt: string;
}

interface Comment {
  id: string;
  content: string;
  authorId: string;
  author: CommentAuthor;
  parentId: string | null;
  isEdited: boolean;
  editedAt: string | null;
  createdAt: string;
  attachments?: CommentAttachment[];
  replies?: Comment[];
}

interface CommentsPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface CommentsResponse {
  comments: Comment[];
  pagination?: CommentsPagination | null;
}

interface CommentsSectionProps {
  entityType: string;
  entityId: string;
}

// Pending attachment interface (before upload)
interface PendingAttachment {
  file: File;
  preview?: string;
}

const COMMENTS_PAGE_LIMIT = 25;

function buildCommentsPath(entityType: string, entityId: string, page: number): string {
  const params = new URLSearchParams({
    entityType,
    entityId,
    page: String(page),
    limit: String(COMMENTS_PAGE_LIMIT),
  });
  return `/api/comments?${params.toString()}`;
}

function extractResponseError(responseText: string, fallback: string): string {
  if (!responseText) return fallback;

  try {
    const parsed: unknown = JSON.parse(responseText);
    if (parsed && typeof parsed === 'object') {
      const data = parsed as {
        error?: string | { message?: string };
        message?: string;
      };

      if (typeof data.error === 'string' && data.error.trim()) {
        return data.error;
      }

      if (data.error && typeof data.error === 'object' && data.error.message?.trim()) {
        return data.error.message;
      }

      if (data.message?.trim()) {
        return data.message;
      }
    }
  } catch {
    // Use the fallback for non-JSON error bodies.
  }

  return fallback;
}

function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function CommentsSection({ entityType, entityId }: CommentsSectionProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [pagination, setPagination] = useState<CommentsPagination | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const revokeAttachmentPreviews = useCallback((attachments: PendingAttachment[]) => {
    attachments.forEach((att) => {
      if (att.preview) URL.revokeObjectURL(att.preview);
    });
  }, []);

  const clearPendingDraft = useCallback(() => {
    revokeAttachmentPreviews(pendingAttachmentsRef.current);
    pendingAttachmentsRef.current = [];
    setPendingAttachments([]);
  }, [revokeAttachmentPreviews]);

  const clearReplyDraft = useCallback(() => {
    revokeAttachmentPreviews(replyAttachmentsRef.current);
    replyAttachmentsRef.current = [];
    setReplyAttachments([]);
    setReplyContent('');
    setReplyingTo(null);
  }, [revokeAttachmentPreviews]);

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
    [replyingTo, revokeAttachmentPreviews],
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
  }, [revokeAttachmentPreviews]);

  useEffect(() => {
    clearPendingDraft();
    clearReplyDraft();
    setNewComment('');
    setEditingId(null);
    setEditContent('');
    setCommentPendingDelete(null);
    setCurrentPage(1);
    setPagination(null);
  }, [entityType, entityId, clearPendingDraft, clearReplyDraft]);

  const fetchComments = useCallback(
    async (page = currentPage) => {
      setLoading(true);
      setError(null);

      try {
        const data = await apiFetch<CommentsResponse>(
          buildCommentsPath(entityType, entityId, page),
        );
        setComments(data.comments || []);
        setPagination(data.pagination || null);
        if (
          data.pagination &&
          data.pagination.totalPages > 0 &&
          page > data.pagination.totalPages
        ) {
          setCurrentPage(data.pagination.totalPages);
        }
      } catch (err) {
        logError('Error fetching comments:', err);
        setError('Failed to load comments');
      } finally {
        setLoading(false);
      }
    },
    [currentPage, entityType, entityId],
  );

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Feature #736: Real-time comment notification polling
  // Poll for new comments every 15 seconds (more frequent for chat-like experience)
  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;

    const silentFetchComments = async () => {
      try {
        const data = await apiFetch<CommentsResponse>(
          buildCommentsPath(entityType, entityId, currentPage),
        );
        const newComments = data.comments || [];
        setPagination(data.pagination || null);

        // Only update if there are actual changes
        setComments((prevComments: Comment[]) => {
          // Check if comments have changed by comparing lengths and IDs
          const hasChanges =
            newComments.length !== prevComments.length ||
            newComments.some(
              (newComment: Comment, index: number) =>
                !prevComments[index] ||
                newComment.id !== prevComments[index].id ||
                newComment.isEdited !== prevComments[index].isEdited ||
                (newComment.replies?.length || 0) !== (prevComments[index].replies?.length || 0),
            );
          return hasChanges ? newComments : prevComments;
        });
      } catch (err) {
        // Silent fail for background polling
        devLog('Background comments fetch failed:', err);
      }
    };

    const startPolling = () => {
      // Poll every 15 seconds for comments (more frequent for chat-like experience)
      pollInterval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          silentFetchComments();
        }
      }, 15000);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        silentFetchComments();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentPage, entityType, entityId]);

  // File validation constants
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ];

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File "${file.name}" exceeds the 10MB size limit.`;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `File "${file.name}" is not a supported format. Allowed: images, PDF, Word, Excel, text files.`;
    }
    return null;
  };

  // Handle file selection for main comment
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: PendingAttachment[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const error = validateFile(file);
      if (error) {
        errors.push(error);
        continue;
      }
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
      newAttachments.push({ file, preview });
    }

    if (errors.length > 0) {
      toast({
        title: 'Some files could not be added',
        description: errors.join(' '),
        variant: 'error',
      });
    }

    if (newAttachments.length > 0) {
      setPendingAttachments((prev) => [...prev, ...newAttachments]);
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

    const newAttachments: PendingAttachment[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const error = validateFile(file);
      if (error) {
        errors.push(error);
        continue;
      }
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
      newAttachments.push({ file, preview });
    }

    if (errors.length > 0) {
      toast({
        title: 'Some files could not be added',
        description: errors.join(' '),
        variant: 'error',
      });
    }

    if (newAttachments.length > 0) {
      setReplyAttachments((prev) => [...prev, ...newAttachments]);
    }

    // Reset input
    if (replyFileInputRef.current) {
      replyFileInputRef.current.value = '';
    }
  };

  // Remove pending attachment
  const removePendingAttachment = (index: number, isReply = false) => {
    if (isReply) {
      setReplyAttachments((prev) => {
        const newArr = [...prev];
        if (newArr[index].preview) URL.revokeObjectURL(newArr[index].preview!);
        newArr.splice(index, 1);
        return newArr;
      });
    } else {
      setPendingAttachments((prev) => {
        const newArr = [...prev];
        if (newArr[index].preview) URL.revokeObjectURL(newArr[index].preview!);
        newArr.splice(index, 1);
        return newArr;
      });
    }
  };

  const uploadFiles = async (
    files: PendingAttachment[],
  ): Promise<{ filename: string; fileUrl: string; fileSize: number; mimeType: string }[]> => {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const formData = new FormData();
    formData.append('entityType', entityType);
    formData.append('entityId', entityId);

    for (const { file } of files) {
      formData.append('files', file);
    }

    const response = await authFetch('/api/comments/attachments/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => '');
      throw new Error(extractResponseError(responseText, 'Failed to upload attachments'));
    }

    const data = (await response.json()) as {
      attachments: { filename: string; fileUrl: string; fileSize: number; mimeType: string }[];
    };
    return data.attachments;
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
      // Upload any pending attachments
      let attachments: { filename: string; fileUrl: string; fileSize: number; mimeType: string }[] =
        [];
      if (pendingAttachments.length > 0) {
        attachments = await uploadFiles(pendingAttachments);
      }

      await apiFetch('/api/comments', {
        method: 'POST',
        body: JSON.stringify({
          entityType,
          entityId,
          content: newComment.trim(),
          attachments,
        }),
      });

      setNewComment('');
      clearPendingDraft();
      setCurrentPage(1);
      await fetchComments(1);
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
      // Upload any pending attachments for reply
      let attachments: { filename: string; fileUrl: string; fileSize: number; mimeType: string }[] =
        [];
      if (replyAttachments.length > 0) {
        attachments = await uploadFiles(replyAttachments);
      }

      await apiFetch('/api/comments', {
        method: 'POST',
        body: JSON.stringify({
          entityType,
          entityId,
          content: replyContent.trim(),
          parentId,
          attachments,
        }),
      });

      clearReplyDraft();
      await fetchComments();
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
      await fetchComments();
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
      await fetchComments();
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

      const token = getAuthToken();
      if (!token) throw new Error('Authentication required');

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

  // Render pending attachments preview
  const renderPendingAttachments = (
    attachments: PendingAttachment[],
    onRemove: (index: number) => void,
  ) => {
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
              className="p-0.5 rounded-full hover:bg-red-100 text-muted-foreground hover:text-red-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
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
                      {renderPendingAttachments(replyAttachments, (i) =>
                        removePendingAttachment(i, true),
                      )}
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
            onClick={() => void fetchComments()}
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
        {renderPendingAttachments(pendingAttachments, (i) => removePendingAttachment(i, false))}
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
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
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
              onClick={() => setCurrentPage((page) => page + 1)}
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

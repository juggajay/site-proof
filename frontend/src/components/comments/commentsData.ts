import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export interface CommentAuthor {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
}

export interface CommentAttachment {
  id: string;
  filename: string;
  downloadUrl?: string;
  fileSize: number | null;
  mimeType: string | null;
  createdAt: string;
}

export interface Comment {
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

export interface CommentsPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface CommentsResponse {
  comments: Comment[];
  pagination?: CommentsPagination | null;
}

export interface NormalizedCommentsResponse {
  comments: Comment[];
  pagination: CommentsPagination | null;
}

export const COMMENTS_PAGE_LIMIT = 25;

export function buildCommentsPath(entityType: string, entityId: string, page: number): string {
  const params = new URLSearchParams({
    entityType,
    entityId,
    page: String(page),
    limit: String(COMMENTS_PAGE_LIMIT),
  });
  return `/api/comments?${params.toString()}`;
}

export function extractResponseError(responseText: string, fallback: string): string {
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

export function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function normalizeCommentsResponse(data: CommentsResponse): NormalizedCommentsResponse {
  return {
    comments: data.comments || [],
    pagination: data.pagination || null,
  };
}

async function fetchCommentsPage(
  entityType: string,
  entityId: string,
  page: number,
): Promise<NormalizedCommentsResponse> {
  const data = await apiFetch<CommentsResponse>(buildCommentsPath(entityType, entityId, page));
  return normalizeCommentsResponse(data);
}

interface UseCommentsQueryOptions {
  onError?: (error: unknown) => void;
}

export function useCommentsQuery(
  entityType: string,
  entityId: string,
  page: number,
  options?: UseCommentsQueryOptions,
) {
  return useQuery({
    queryKey: queryKeys.comments(entityType, entityId, page),
    queryFn: () => fetchCommentsPage(entityType, entityId, page),
    // The comments panel is chat-like: always refetch fresh on mount/focus and
    // poll while the tab is visible, matching the prior hand-rolled fetch + 15s
    // visibility-gated poll (Feature #736). Structural sharing (react-query
    // default) replaces the manual "only update if changed" diff.
    staleTime: 0,
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    onError: options?.onError,
  });
}

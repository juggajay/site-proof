/**
 * Characterization tests for CommentsSection ahead of future decomposition and
 * the TanStack Query migration. These pin the behaviors that source-text
 * readiness guards cannot verify end to end:
 *
 * - the comments fetch path carries entityType/entityId/page and the fixed
 *   25-per-page limit;
 * - text-only comments post as a single JSON request, while comments with
 *   attachments post as ONE multipart request to /api/comments;
 * - switching entities resets the composer draft, pending-delete dialog, and
 *   pagination, revoking outstanding attachment preview URLs;
 * - unmounting revokes outstanding preview URLs;
 * - switching reply targets discards (and revokes) stale reply attachments.
 *
 * Mock only the network/auth/toast boundaries; the component, its draft
 * helpers, and the comments Query module stay real.
 */

import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn(), authFetch: vi.fn() };
});

vi.mock('@/lib/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/config')>();
  return { ...actual, SUPABASE_URL: 'https://example.supabase.co' };
});

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return { ...actual, useAuth: vi.fn() };
});

vi.mock('@/lib/downloads', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/downloads')>();
  return { ...actual, downloadBlob: vi.fn() };
});

vi.mock('@/components/ui/toaster', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui/toaster')>();
  return { ...actual, toast: vi.fn() };
});

import { apiFetch, authFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { downloadBlob } from '@/lib/downloads';
import { CommentsSection } from './CommentsSection';
import { type Comment, type CommentsPagination } from './commentsData';

const apiFetchMock = vi.mocked(apiFetch) as unknown as MockInstance<
  (path: string, options?: RequestInit) => Promise<unknown>
>;
const authFetchMock = vi.mocked(authFetch) as unknown as MockInstance<
  (path: string, options?: RequestInit) => Promise<Response>
>;
const useAuthMock = vi.mocked(useAuth);
const downloadBlobMock = vi.mocked(downloadBlob);

const author = {
  id: 'user-1',
  email: 'author@example.com',
  fullName: 'Test Author',
  avatarUrl: null,
};

function makeComment(id: string, content: string): Comment {
  return {
    id,
    content,
    authorId: 'user-1',
    author,
    parentId: null,
    isEdited: false,
    editedAt: null,
    createdAt: '2026-06-01T00:00:00.000Z',
    attachments: [],
    replies: [],
  };
}

const singlePagePagination: CommentsPagination = {
  total: 2,
  page: 1,
  limit: 25,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false,
};

let commentsFetchPaths: string[] = [];
let commentsRoute: (page: number, entityId: string) => unknown;

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
let createObjectURLMock: ReturnType<typeof vi.fn>;
let revokeObjectURLMock: ReturnType<typeof vi.fn>;

function makeImageFile(name: string): File {
  return new File(['x'], name, { type: 'image/png' });
}

function mainFileInput(container: HTMLElement): HTMLInputElement {
  // The composer's hidden file input is the first file input in the DOM;
  // the reply file input only renders while a reply form is open.
  const input = container.querySelectorAll<HTMLInputElement>('input[type="file"]')[0];
  expect(input).toBeDefined();
  return input;
}

function renderComments(entityId = 'lot-1') {
  return renderWithProviders(<CommentsSection entityType="Lot" entityId={entityId} />);
}

describe('CommentsSection characterization', () => {
  beforeEach(() => {
    commentsFetchPaths = [];
    commentsRoute = () => ({
      comments: [makeComment('c1', 'First comment'), makeComment('c2', 'Second comment')],
      pagination: singlePagePagination,
    });

    apiFetchMock.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === '/api/comments' && options?.method === 'POST') {
        return {};
      }
      if (path.startsWith('/api/comments?')) {
        commentsFetchPaths.push(path);
        const params = new URLSearchParams(path.split('?')[1]);
        return commentsRoute(Number(params.get('page')), params.get('entityId') ?? '');
      }
      if (path === '/api/comments' && (!options || !options.method)) {
        throw new Error('Comments list fetch must include query parameters');
      }
      throw new Error(`Unexpected apiFetch call: ${path}`);
    });

    authFetchMock.mockResolvedValue({ ok: true } as Response);
    downloadBlobMock.mockReset();

    useAuthMock.mockReturnValue({
      user: { id: 'user-1', email: 'author@example.com', fullName: 'Test Author' },
    } as unknown as ReturnType<typeof useAuth>);

    let previewCount = 0;
    createObjectURLMock = vi.fn(() => `blob:preview-${++previewCount}`);
    revokeObjectURLMock = vi.fn();
    URL.createObjectURL = createObjectURLMock as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURLMock as typeof URL.revokeObjectURL;

    return () => {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    };
  });

  it('fetches the comments list with entity, page, and the fixed 25-per-page limit', async () => {
    renderComments();

    await screen.findByText('First comment');

    expect(commentsFetchPaths[0]).toBe(
      '/api/comments?entityType=Lot&entityId=lot-1&page=1&limit=25',
    );
  });

  it('posts a text-only comment as a single JSON create request', async () => {
    renderComments();
    await screen.findByText('First comment');

    fireEvent.change(screen.getByPlaceholderText(/Add a comment/), {
      target: { value: 'A plain note' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Post Comment/ }));

    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith('/api/comments', {
        method: 'POST',
        body: JSON.stringify({ entityType: 'Lot', entityId: 'lot-1', content: 'A plain note' }),
      }),
    );
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it('posts a comment with attachments as one multipart request to /api/comments', async () => {
    const { container } = renderComments();
    await screen.findByText('First comment');

    fireEvent.change(mainFileInput(container), {
      target: { files: [makeImageFile('photo.png')] },
    });
    await screen.findByText('photo.png');
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByPlaceholderText(/Add a comment/), {
      target: { value: 'With attachment' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Post Comment/ }));

    await waitFor(() => expect(authFetchMock).toHaveBeenCalledTimes(1));

    const [path, init] = authFetchMock.mock.calls[0];
    expect(path).toBe('/api/comments');
    expect(init?.method).toBe('POST');
    const formData = init?.body as FormData;
    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get('entityType')).toBe('Lot');
    expect(formData.get('entityId')).toBe('lot-1');
    expect(formData.get('content')).toBe('With attachment');
    const files = formData.getAll('files');
    expect(files).toHaveLength(1);
    expect((files[0] as File).name).toBe('photo.png');

    // No JSON create request fires alongside the multipart one.
    const jsonPosts = apiFetchMock.mock.calls.filter(
      ([, options]) => (options as RequestInit | undefined)?.method === 'POST',
    );
    expect(jsonPosts).toHaveLength(0);

    // The accepted draft is cleared after posting, revoking its preview URL.
    await waitFor(() => expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:preview-1'));
    expect(screen.queryByText('photo.png')).not.toBeInTheDocument();
  });

  it('downloads Supabase-backed comment attachments through the authenticated API', async () => {
    const attachment = {
      id: 'att-1',
      filename: 'evidence.png',
      downloadUrl: '/api/comments/attachments/att-1/download',
      fileSize: 12,
      mimeType: 'image/png',
      createdAt: '2026-06-01T00:00:00.000Z',
    };
    commentsRoute = () => ({
      comments: [{ ...makeComment('c1', 'With evidence'), attachments: [attachment] }],
      pagination: { ...singlePagePagination, total: 1 },
    });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    authFetchMock.mockResolvedValueOnce(
      new Response('evidence bytes', { status: 200, headers: { 'Content-Type': 'image/png' } }),
    );

    try {
      renderComments();
      await screen.findByText('evidence.png');
      fireEvent.click(screen.getByRole('button', { name: 'Download evidence.png' }));

      await waitFor(() =>
        expect(authFetchMock).toHaveBeenCalledWith('/api/comments/attachments/att-1/download'),
      );
      expect(openSpy).not.toHaveBeenCalled();
      expect(downloadBlobMock).toHaveBeenCalledTimes(1);
      const [blob, filename, fallback] = downloadBlobMock.mock.calls[0];
      expect(blob.type).toBe('image/png');
      expect(filename).toBe('evidence.png');
      expect(fallback).toBe('attachment');
    } finally {
      openSpy.mockRestore();
    }
  });

  it('switching entities resets the composer draft, pending delete, and previews', async () => {
    const { container, rerender } = renderComments();
    await screen.findByText('First comment');

    fireEvent.change(screen.getByPlaceholderText(/Add a comment/), {
      target: { value: 'Draft in progress' },
    });
    fireEvent.change(mainFileInput(container), {
      target: { files: [makeImageFile('draft.png')] },
    });
    await screen.findByText('draft.png');

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete comment' })[0]);
    expect(screen.getByText(/This comment and any attachments will be removed/)).toBeVisible();

    rerender(<CommentsSection entityType="Lot" entityId="lot-2" />);

    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:preview-1');
    expect(screen.getByPlaceholderText(/Add a comment/)).toHaveValue('');
    expect(screen.queryByText('draft.png')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/This comment and any attachments will be removed/),
    ).not.toBeInTheDocument();
  });

  it('switching entities resets pagination back to page 1', async () => {
    commentsRoute = (page: number) => ({
      comments:
        page === 1
          ? [makeComment('c1', 'First comment')]
          : [makeComment('c26', 'Page two comment')],
      pagination: {
        total: 30,
        page,
        limit: 25,
        totalPages: 2,
        hasNextPage: page === 1,
        hasPrevPage: page === 2,
      },
    });

    const { rerender } = renderComments();
    await screen.findByText('First comment');

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Page two comment');
    expect(commentsFetchPaths.at(-1)).toContain('entityId=lot-1&page=2&limit=25');

    rerender(<CommentsSection entityType="Lot" entityId="lot-2" />);

    await waitFor(() =>
      expect(commentsFetchPaths.at(-1)).toContain('entityId=lot-2&page=1&limit=25'),
    );
  });

  it('revokes outstanding attachment previews on unmount', async () => {
    const { container, unmount } = renderComments();
    await screen.findByText('First comment');

    fireEvent.change(mainFileInput(container), {
      target: { files: [makeImageFile('orphan.png')] },
    });
    await screen.findByText('orphan.png');
    expect(revokeObjectURLMock).not.toHaveBeenCalled();

    unmount();

    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:preview-1');
  });

  it('switching reply targets discards and revokes stale reply attachments', async () => {
    const { container } = renderComments();
    await screen.findByText('First comment');

    // Open the reply form on the first comment and attach a file to it.
    fireEvent.click(screen.getAllByRole('button', { name: 'Reply' })[0]);
    const replyInput = container.querySelectorAll<HTMLInputElement>('input[type="file"]')[1];
    expect(replyInput).toBeDefined();
    fireEvent.change(replyInput, { target: { files: [makeImageFile('reply.png')] } });
    await screen.findByText('reply.png');

    // The open reply form's submit button is disabled (no text yet); the other
    // comment's begin-reply button is the only enabled "Reply" button.
    const beginReplyOnSecond = screen
      .getAllByRole('button', { name: 'Reply' })
      .find((button) => !button.hasAttribute('disabled'));
    expect(beginReplyOnSecond).toBeDefined();
    fireEvent.click(beginReplyOnSecond!);

    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:preview-1');
    expect(screen.queryByText('reply.png')).not.toBeInTheDocument();
  });
});

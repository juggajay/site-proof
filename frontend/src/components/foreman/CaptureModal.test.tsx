import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';

// CaptureModal's "Defect" mode now raises a REAL NCR via POST /api/ncrs when the
// device is online, then keeps the photo (linked to the new NCR). When offline -
// or if NCR creation fails - it keeps the photo but tells the truth: no NCR was
// raised. Boundary modules are mocked so the test is about wording + payload.
vi.mock('@/hooks/useGeoLocation', () => ({
  useGeoLocation: () => ({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    loading: false,
    refresh: vi.fn(),
    isSupported: false,
  }),
}));
vi.mock('@/lib/offlineDb', () => ({ capturePhotoOffline: vi.fn() }));
vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));
vi.mock('@/components/ui/VoiceInputButton', () => ({ VoiceInputButton: () => null }));
vi.mock('@/lib/auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn(), authFetch: vi.fn() };
});

import { CaptureModal } from './CaptureModal';
import { capturePhotoOffline } from '@/lib/offlineDb';
import { toast } from '@/components/ui/toaster';
import { useAuth } from '@/lib/auth';
import { apiFetch, authFetch } from '@/lib/api';

const capturePhotoOfflineMock = vi.mocked(capturePhotoOffline);
const toastMock = vi.mocked(toast);
const useAuthMock = vi.mocked(useAuth);
const apiFetchMock = vi.mocked(apiFetch);
const authFetchMock = vi.mocked(authFetch);

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
}

// apiFetch is used both for the lot dropdown read (GET /api/lots...) and the NCR
// create (POST /api/ncrs). Route by path so each test asserts the create payload.
function mockApi({ ncr }: { ncr?: { id: string; ncrNumber: string } } = {}) {
  apiFetchMock.mockImplementation(((path: string) => {
    if (typeof path === 'string' && path === '/api/ncrs') {
      if (!ncr) return Promise.reject(new Error('NCR create failed'));
      return Promise.resolve({ ncr });
    }
    return Promise.resolve({ lots: [] });
  }) as unknown as typeof apiFetch);
}

// Simulate the native camera/file pick, which advances the modal from the
// "capture" phase to the "categorize" phase (via FileReader onload).
async function captureAPhoto(container: HTMLElement) {
  const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
  fireEvent.change(fileInput, { target: { files: [file] } });
  await screen.findByText('Captured');
}

function descriptionsFromToasts() {
  return toastMock.mock.calls.map(([arg]) => (arg as { description?: string }).description ?? '');
}

beforeEach(() => {
  setOnline(true);
  useAuthMock.mockReturnValue({
    user: { id: 'u1', fullName: 'Fred Foreman' },
  } as unknown as ReturnType<typeof useAuth>);
  mockApi({ ncr: { id: 'ncr-1', ncrNumber: 'NCR-0007' } });
  authFetchMock.mockResolvedValue(
    new Response(JSON.stringify({ id: 'doc-1' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  capturePhotoOfflineMock.mockResolvedValue({ id: 'photo-1' } as unknown as Awaited<
    ReturnType<typeof capturePhotoOffline>
  >);
});

afterEach(() => {
  setOnline(true);
  vi.clearAllMocks();
});

describe('CaptureModal defect mode', () => {
  it('labels the issue mode as a Defect, with an honest save affordance', async () => {
    const { container } = renderWithProviders(
      <CaptureModal projectId="p1" isOpen onClose={vi.fn()} />,
    );
    await captureAPhoto(container);

    expect(screen.getByText('Defect')).toBeInTheDocument();
    expect(screen.queryByText('NCR/Defect')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Defect'));

    expect(screen.getByRole('button', { name: 'Save Defect Photo' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Brief defect description')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save NCR' })).not.toBeInTheDocument();
  });

  it('online: raises a real NCR, attaches the photo evidence, and toasts the real number', async () => {
    const onClose = vi.fn();
    const { container } = renderWithProviders(
      <CaptureModal projectId="p1" isOpen onClose={onClose} />,
    );
    await captureAPhoto(container);

    fireEvent.click(screen.getByText('Defect'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Defect Photo' }));

    // A real NCR is created first via the existing POST /api/ncrs contract.
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/api/ncrs',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    const ncrCall = apiFetchMock.mock.calls.find(([path]) => path === '/api/ncrs');
    const sentBody = JSON.parse((ncrCall?.[1] as { body: string }).body);
    expect(sentBody).toMatchObject({
      projectId: 'p1',
      description: 'Defect captured on site - details pending',
      category: 'general',
    });

    await waitFor(() =>
      expect(authFetchMock).toHaveBeenCalledWith(
        '/api/documents/upload',
        expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
      ),
    );
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith('/api/ncrs/ncr-1/evidence', {
        method: 'POST',
        body: JSON.stringify({
          documentId: 'doc-1',
          evidenceType: 'photo',
        }),
      }),
    );
    expect(capturePhotoOfflineMock).not.toHaveBeenCalled();

    // The toast carries the real NCR number from the response.
    await waitFor(() => expect(toastMock).toHaveBeenCalled());
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'NCR NCR-0007 raised - add details from the NCR register.',
        variant: 'success',
      }),
    );
    expect(descriptionsFromToasts().some((d) => d.includes('Photo saved offline'))).toBe(false);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('online: attaches the captured file to the raised NCR via the evidence contract', async () => {
    const onClose = vi.fn();
    const { container } = renderWithProviders(
      <CaptureModal projectId="p1" isOpen onClose={onClose} />,
    );
    await captureAPhoto(container);

    fireEvent.click(screen.getByText('Defect'));
    fireEvent.change(screen.getByPlaceholderText('Brief defect description'), {
      target: { value: 'Cracked kerb face' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Defect Photo' }));

    await waitFor(() =>
      expect(authFetchMock).toHaveBeenCalledWith(
        '/api/documents/upload',
        expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
      ),
    );
    const uploadForm = authFetchMock.mock.calls[0][1]?.body as FormData;
    expect(uploadForm.get('projectId')).toBe('p1');
    expect(uploadForm.get('documentType')).toBe('ncr_evidence');
    expect(uploadForm.get('category')).toBe('ncr_evidence');
    expect(uploadForm.get('caption')).toBe('Cracked kerb face');

    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith('/api/ncrs/ncr-1/evidence', {
        method: 'POST',
        body: JSON.stringify({
          documentId: 'doc-1',
          evidenceType: 'photo',
          caption: 'Cracked kerb face',
        }),
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('offline: keeps the photo but never claims an NCR was raised (no API call)', async () => {
    setOnline(false);
    const onClose = vi.fn();
    const { container } = renderWithProviders(
      <CaptureModal projectId="p1" isOpen onClose={onClose} />,
    );
    await captureAPhoto(container);

    fireEvent.click(screen.getByText('Defect'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Defect Photo' }));

    // The photo is still saved offline-first.
    await waitFor(() => expect(capturePhotoOfflineMock).toHaveBeenCalledTimes(1));

    // No NCR create is attempted while offline.
    expect(apiFetchMock.mock.calls.some(([path]) => path === '/api/ncrs')).toBe(false);

    // Honest toast: no false "NCR raised".
    await waitFor(() => expect(toastMock).toHaveBeenCalled());
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        description:
          "Photo saved offline - raise the NCR from the NCR register when you're back online.",
        variant: 'success',
      }),
    );
    expect(descriptionsFromToasts().some((d) => d.includes('raised'))).toBe(false);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('online NCR-create failure: keeps the photo, falls back to honest offline wording', async () => {
    mockApi({ ncr: undefined }); // POST /api/ncrs rejects
    const onClose = vi.fn();
    const { container } = renderWithProviders(
      <CaptureModal projectId="p1" isOpen onClose={onClose} />,
    );
    await captureAPhoto(container);

    fireEvent.click(screen.getByText('Defect'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Defect Photo' }));

    // The create was attempted but failed - photo is still saved.
    await waitFor(() => expect(capturePhotoOfflineMock).toHaveBeenCalledTimes(1));
    expect(apiFetchMock.mock.calls.some(([path]) => path === '/api/ncrs')).toBe(true);

    // Not linked to a non-existent NCR; falls back to optional ITP linkage (none here).
    expect(capturePhotoOfflineMock).toHaveBeenCalledWith(
      'p1',
      expect.any(File),
      expect.objectContaining({
        entityType: 'ncr',
        entityId: undefined,
        documentType: 'ncr_evidence',
        category: 'ncr_evidence',
      }),
    );

    // Honest fallback wording - never a false success number.
    await waitFor(() => expect(toastMock).toHaveBeenCalled());
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        description:
          "Photo saved offline - raise the NCR from the NCR register when you're back online.",
        variant: 'success',
      }),
    );
    expect(descriptionsFromToasts().some((d) => d.includes('raised'))).toBe(false);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('header Save honours the chosen Defect + description (M56: no silent plain-photo save)', async () => {
    const onClose = vi.fn();
    const { container } = renderWithProviders(
      <CaptureModal projectId="p1" isOpen onClose={onClose} />,
    );
    await captureAPhoto(container);

    fireEvent.click(screen.getByText('Defect'));
    fireEvent.change(screen.getByPlaceholderText('Brief defect description'), {
      target: { value: 'Cracked kerb face' },
    });

    // The persistent top-right header "Save" (exact name) — NOT the contextual
    // "Save Defect Photo" button — must honour the chosen type + description and
    // raise the NCR, instead of silently resetting to a plain photo.
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/api/ncrs',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    const ncrCall = apiFetchMock.mock.calls.find(([path]) => path === '/api/ncrs');
    const sentBody = JSON.parse((ncrCall?.[1] as { body: string }).body);
    expect(sentBody).toMatchObject({ projectId: 'p1', description: 'Cracked kerb face' });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('non-defect photo capture is unchanged: no NCR call, plain "Photo saved" toast', async () => {
    const onClose = vi.fn();
    const { container } = renderWithProviders(
      <CaptureModal projectId="p1" isOpen onClose={onClose} />,
    );
    await captureAPhoto(container);

    // Default type is Photo; save via the categorize-phase Save button.
    fireEvent.click(screen.getByRole('button', { name: 'Save Photo' }));

    await waitFor(() => expect(capturePhotoOfflineMock).toHaveBeenCalledTimes(1));
    expect(capturePhotoOfflineMock).toHaveBeenCalledWith(
      'p1',
      expect.any(File),
      expect.objectContaining({ entityType: 'general', documentType: 'photo' }),
    );
    // No NCR is raised for a plain photo.
    expect(apiFetchMock.mock.calls.some(([path]) => path === '/api/ncrs')).toBe(false);
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith({
        description: 'Photo saved',
        variant: 'success',
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

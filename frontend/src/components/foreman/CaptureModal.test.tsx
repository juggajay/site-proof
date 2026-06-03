import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';

// CaptureModal's "Defect" mode only saves a defect-tagged photo/document; it does
// NOT raise an NCR record. These tests lock the copy so the UI never claims an NCR
// was created. Boundary modules are mocked so the test is about wording + payload.
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
  return { ...actual, apiFetch: vi.fn() };
});

import { CaptureModal } from './CaptureModal';
import { capturePhotoOffline } from '@/lib/offlineDb';
import { toast } from '@/components/ui/toaster';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

const capturePhotoOfflineMock = vi.mocked(capturePhotoOffline);
const toastMock = vi.mocked(toast);
const useAuthMock = vi.mocked(useAuth);
const apiFetchMock = vi.mocked(apiFetch);

// Simulate the native camera/file pick, which advances the modal from the
// "capture" phase to the "categorize" phase (via FileReader onload).
async function captureAPhoto(container: HTMLElement) {
  const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
  fireEvent.change(fileInput, { target: { files: [file] } });
  await screen.findByText('Captured');
}

beforeEach(() => {
  useAuthMock.mockReturnValue({
    user: { id: 'u1', fullName: 'Fred Foreman' },
  } as unknown as ReturnType<typeof useAuth>);
  apiFetchMock.mockResolvedValue({ lots: [] });
  capturePhotoOfflineMock.mockResolvedValue({ id: 'photo-1' } as unknown as Awaited<
    ReturnType<typeof capturePhotoOffline>
  >);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('CaptureModal issue wording is honest', () => {
  it('labels the issue mode as a Defect photo, never an NCR record', async () => {
    const { container } = renderWithProviders(
      <CaptureModal projectId="p1" isOpen onClose={vi.fn()} />,
    );
    await captureAPhoto(container);

    // The mode chip no longer implies an NCR is created.
    expect(screen.getByText('Defect')).toBeInTheDocument();
    expect(screen.queryByText('NCR/Defect')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Defect'));

    // Honest save affordance + placeholder; the old "Save NCR" copy is gone.
    expect(screen.getByRole('button', { name: 'Save Defect Photo' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Brief defect description')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save NCR' })).not.toBeInTheDocument();
  });

  it('saves a defect-tagged photo and shows an honest toast (no false "NCR captured")', async () => {
    const onClose = vi.fn();
    const { container } = renderWithProviders(
      <CaptureModal projectId="p1" isOpen onClose={onClose} />,
    );
    await captureAPhoto(container);

    fireEvent.click(screen.getByText('Defect'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Defect Photo' }));

    // Payload is unchanged: still stored as a defect-tagged photo/document.
    await waitFor(() => expect(capturePhotoOfflineMock).toHaveBeenCalledTimes(1));
    expect(capturePhotoOfflineMock).toHaveBeenCalledWith(
      'p1',
      expect.any(File),
      expect.objectContaining({ entityType: 'ncr', documentType: 'ncr_evidence' }),
    );

    // The success toast must not claim an NCR record was raised.
    await waitFor(() => expect(toastMock).toHaveBeenCalled());
    const descriptions = toastMock.mock.calls.map(
      ([arg]) => (arg as { description?: string }).description ?? '',
    );
    expect(descriptions.some((d) => d.includes('NCR captured'))).toBe(false);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Defect photo saved. Raise an NCR from the lot to log it formally.',
        variant: 'success',
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

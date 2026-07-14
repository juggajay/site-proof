import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';
import { MarkAsFailedModal } from './MarkAsFailedModal';

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
}

function renderModal(over: Partial<Parameters<typeof MarkAsFailedModal>[0]> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onAddPhoto = vi.fn().mockResolvedValue(undefined);
  const props = {
    isOpen: true,
    itemDescription: 'Compact subgrade to spec',
    onClose: vi.fn(),
    onSubmit,
    isSubmitting: false,
    onAddPhoto,
    photoCount: 0,
    ...over,
  };
  return { onSubmit, onAddPhoto, ...renderWithProviders(<MarkAsFailedModal {...props} />) };
}

const submitBtn = () => screen.getByRole('button', { name: /Mark as Failed & Raise NCR/i });

async function typeDescription() {
  fireEvent.change(screen.getByPlaceholderText(/Describe the non-conformance/i), {
    target: { value: 'Pumping under proof roll' },
  });
}

beforeEach(() => setOnline(true));
afterEach(() => {
  setOnline(true);
  vi.clearAllMocks();
});

describe('MarkAsFailedModal — photo evidence gate', () => {
  it('online: blocks submit until a photo is attached', async () => {
    setOnline(true);
    const { onSubmit } = renderModal({ photoCount: 0 });

    expect(submitBtn()).toBeDisabled();
    await typeDescription();
    fireEvent.click(submitBtn());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: /Add a photo of the issue \(required\)/i }),
    ).toBeInTheDocument();
  });

  it('online: allows submit once a photo is attached', async () => {
    setOnline(true);
    const { onSubmit } = renderModal({ photoCount: 1 });

    await typeDescription();
    expect(submitBtn()).toBeEnabled();
    fireEvent.click(submitBtn());
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith('Pumping under proof roll', 'workmanship', 'minor'),
    );
  });

  it('offline: allows a note-only submit with no photo', async () => {
    setOnline(false);
    const { onSubmit } = renderModal({ photoCount: 0 });

    expect(screen.getByText(/Offline — photo can be added after sync/i)).toBeInTheDocument();
    await typeDescription();
    expect(submitBtn()).toBeEnabled();
    fireEvent.click(submitBtn());
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith('Pumping under proof roll', 'workmanship', 'minor'),
    );
  });

  it('forwards a selected photo to onAddPhoto', () => {
    setOnline(true);
    const { onAddPhoto } = renderModal({ photoCount: 0 });

    const file = new File(['x'], 'defect.jpg', { type: 'image/jpeg' });
    // The Modal renders into a portal on document.body, so query the document.
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    expect(onAddPhoto).toHaveBeenCalledWith(file);
  });
});

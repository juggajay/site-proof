/**
 * Honest save-failure feedback for the weather sheet.
 *
 * The diary is legal evidence: a failed weather save used to be swallowed by
 * useDiaryMobileHandlers, so the sheet fired the SUCCESS haptic and closed as
 * if the entry was recorded. These tests pin the corrected contract: on
 * failure the sheet stays open with the typed values intact, shows an inline
 * failure banner, and the banner's Retry can complete the save.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';
import { readSessionStorageItem, removeSessionStorageItem } from '@/lib/storagePreferences';
import { AddWeatherSheet } from './AddWeatherSheet';
import { sheetDraftKey } from './useSheetDraft';

const BANNER_TEXT = /couldn.t save — your entry is kept\. try again\./i;

function renderSheet(onSave: (data: unknown) => Promise<void>) {
  const onClose = vi.fn();
  renderWithProviders(
    <AddWeatherSheet isOpen onClose={onClose} onSave={onSave} initialData={null} />,
  );
  return { onClose };
}

describe('AddWeatherSheet save failure', () => {
  it('keeps the sheet open with typed values and shows the failure banner', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('network down'));
    const { onClose } = renderSheet(onSave);

    fireEvent.click(screen.getByRole('button', { name: 'Rain' }));
    fireEvent.change(screen.getByPlaceholderText('e.g. 12'), { target: { value: '14' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Weather' }));

    expect(await screen.findByText(BANNER_TEXT)).toBeInTheDocument();

    // The sheet must NOT close — closing would discard the foreman's entry.
    expect(onClose).not.toHaveBeenCalled();
    // The typed state is still there for the retry.
    expect(screen.getByPlaceholderText('e.g. 12')).toHaveValue(14);
  });

  it('retries from the banner and only closes once the save succeeds', async () => {
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(undefined);
    const { onClose } = renderSheet(onSave);

    fireEvent.click(screen.getByRole('button', { name: 'Save Weather' }));
    expect(await screen.findByText(BANNER_TEXT)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it('closes without a banner when the save succeeds first time', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { onClose } = renderSheet(onSave);

    fireEvent.click(screen.getByRole('button', { name: 'Save Weather' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument();
  });
});

/**
 * Auto-draft for the weather sheet. Weather is special: the fields arrive
 * auto-populated (diary values or the fetched forecast), so the baseline for
 * "did the foreman actually type something?" is the initialData — opening and
 * dismissing an untouched sheet must never create a phantom draft.
 */
describe('AddWeatherSheet auto-draft', () => {
  const KEY = sheetDraftKey('proj-1', '2026-06-10', 'weather');
  const AUTO_POPULATED = {
    conditions: 'Fine',
    temperatureMin: '12',
    temperatureMax: '28',
    rainfallMm: '0',
  };

  function renderDraftSheet(initialData: typeof AUTO_POPULATED | null = AUTO_POPULATED) {
    const onClose = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const view = renderWithProviders(
      <AddWeatherSheet
        isOpen
        onClose={onClose}
        onSave={onSave}
        initialData={initialData}
        draftKey={KEY}
      />,
    );
    return { onClose, onSave, view };
  }

  beforeEach(() => {
    removeSessionStorageItem(KEY);
  });

  afterEach(() => {
    removeSessionStorageItem(KEY);
  });

  it('never stores a phantom draft for untouched auto-populated weather', () => {
    const { view } = renderDraftSheet();
    expect(screen.queryByText(/draft restored/i)).not.toBeInTheDocument();

    view.unmount();
    expect(readSessionStorageItem(KEY)).toBeNull();
  });

  it('persists foreman-modified weather on dismissal and restores it on reopen', () => {
    const { view } = renderDraftSheet();
    fireEvent.change(screen.getByPlaceholderText('e.g. 28'), { target: { value: '31' } });
    view.unmount();

    expect(readSessionStorageItem(KEY)).not.toBeNull();

    renderDraftSheet();
    expect(screen.getByPlaceholderText('e.g. 28')).toHaveValue(31);
    // Untouched fields restore their auto-populated values.
    expect(screen.getByPlaceholderText('e.g. 12')).toHaveValue(12);
    expect(screen.getByText(/draft restored/i)).toBeInTheDocument();
  });

  it('late-arriving auto-populated weather does not clobber a restored draft', () => {
    const first = renderDraftSheet();
    fireEvent.change(screen.getByPlaceholderText('e.g. 28'), { target: { value: '31' } });
    first.view.unmount();

    // Reopen before the forecast fetch resolves, then let it arrive.
    const second = renderDraftSheet(null);
    expect(screen.getByPlaceholderText('e.g. 28')).toHaveValue(31);

    second.view.rerender(
      <AddWeatherSheet
        isOpen
        onClose={vi.fn()}
        onSave={vi.fn()}
        initialData={AUTO_POPULATED}
        draftKey={KEY}
      />,
    );
    expect(screen.getByPlaceholderText('e.g. 28')).toHaveValue(31);
  });

  it('clears the draft once the save resolves', async () => {
    const { onClose } = renderDraftSheet();
    fireEvent.change(screen.getByPlaceholderText('e.g. 28'), { target: { value: '31' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save Weather' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(readSessionStorageItem(KEY)).toBeNull();
  });

  it('discard resets the fields to the auto-populated values', () => {
    const first = renderDraftSheet();
    fireEvent.change(screen.getByPlaceholderText('e.g. 28'), { target: { value: '31' } });
    first.view.unmount();

    renderDraftSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

    expect(screen.getByPlaceholderText('e.g. 28')).toHaveValue(28);
    expect(screen.queryByText(/draft restored/i)).not.toBeInTheDocument();
    expect(readSessionStorageItem(KEY)).toBeNull();
  });
});

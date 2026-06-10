/**
 * Honest save-failure feedback for the weather sheet.
 *
 * The diary is legal evidence: a failed weather save used to be swallowed by
 * useDiaryMobileHandlers, so the sheet fired the SUCCESS haptic and closed as
 * if the entry was recorded. These tests pin the corrected contract: on
 * failure the sheet stays open with the typed values intact, shows an inline
 * failure banner, and the banner's Retry can complete the save.
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';
import { AddWeatherSheet } from './AddWeatherSheet';

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

/**
 * Auto-draft round-trip for the activity sheet.
 *
 * A foreman mid-entry who gets interrupted (phone call, app backgrounded,
 * accidental overlay tap) must never lose typed work: dismissing the sheet
 * persists a draft, reopening the same project + diary date + sheet restores
 * it with a dismissible hint, and a successful save (online or queued
 * offline, which also resolves — #788) clears it.
 *
 * Storage access in tests goes through @/lib/storagePreferences too — the
 * readiness guardrail scans every file under src/, tests included.
 */

import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';
import {
  readSessionStorageItem,
  removeSessionStorageItem,
  writeSessionStorageItem,
} from '@/lib/storagePreferences';
import { AddActivitySheet } from './AddActivitySheet';
import { sheetDraftKey } from './useSheetDraft';

// The mic's SpeechRecognition plumbing is exercised in useDictation.test.ts;
// here we only need a supported mic whose start() yields a final transcript.
vi.mock('@/hooks/useDictation', () => ({
  useDictation: ({ onTranscript }: { onTranscript: (t: string) => void }) => ({
    supported: true,
    listening: false,
    start: () => onTranscript('compacted to spec'),
    stop: () => {},
    error: null,
  }),
}));

const KEY = sheetDraftKey('proj-1', '2026-06-10', 'activity');
const LOTS = [{ id: 'lot-1', lotNumber: '001' }];

function renderSheet(
  overrides: Partial<ComponentProps<typeof AddActivitySheet>> = {},
  onSave: (data: unknown) => Promise<void> = vi.fn().mockResolvedValue(undefined),
) {
  const onClose = vi.fn();
  const view = renderWithProviders(
    <AddActivitySheet
      isOpen
      onClose={onClose}
      onSave={onSave}
      defaultLotId={null}
      lots={LOTS}
      draftKey={KEY}
      {...overrides}
    />,
  );
  return { onClose, view };
}

beforeEach(() => {
  removeSessionStorageItem(KEY);
});

afterEach(() => {
  removeSessionStorageItem(KEY);
});

describe('AddActivitySheet auto-draft', () => {
  it('round-trips an interrupted entry through dismissal and reopen', () => {
    const { view } = renderSheet();

    fireEvent.change(screen.getByPlaceholderText('What work was done?'), {
      target: { value: 'Poured slab footing' },
    });
    fireEvent.click(screen.getByText('More details'));
    fireEvent.change(screen.getByPlaceholderText('m3, tonnes...'), { target: { value: 'm3' } });

    // Overlay-tap dismissal unmounts the sheet — the draft must flush
    // immediately, not after a debounce.
    view.unmount();
    expect(readSessionStorageItem(KEY)).not.toBeNull();

    renderSheet();
    expect(screen.getByPlaceholderText('What work was done?')).toHaveValue('Poured slab footing');
    // "More details" auto-expands so the restored unit is visible.
    expect(screen.getByPlaceholderText('m3, tonnes...')).toHaveValue('m3');
    expect(screen.getByText(/draft restored/i)).toBeInTheDocument();
  });

  it('does not show a hint or store a draft when nothing was typed', () => {
    const { view } = renderSheet();
    expect(screen.queryByText(/draft restored/i)).not.toBeInTheDocument();

    view.unmount();
    expect(readSessionStorageItem(KEY)).toBeNull();
  });

  it('clears the draft when the save resolves (online or queued offline)', async () => {
    const { onClose } = renderSheet();

    fireEvent.change(screen.getByPlaceholderText('What work was done?'), {
      target: { value: 'Backfilled trench' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Activity' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(readSessionStorageItem(KEY)).toBeNull();
  });

  it('keeps the draft when the save fails (#776 contract intact)', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('network down'));
    const { onClose } = renderSheet({}, onSave);

    fireEvent.change(screen.getByPlaceholderText('What work was done?'), {
      target: { value: 'Stripped formwork' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Activity' }));

    expect(
      await screen.findByText(/couldn.t save — your entry is kept\. try again\./i),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    // The debounced draft write still lands — dual protection with the banner.
    await waitFor(() => expect(readSessionStorageItem(KEY)).not.toBeNull());
  });

  it('discards the draft and resets the fields from the restored hint', () => {
    writeSessionStorageItem(
      KEY,
      JSON.stringify({ description: 'Old draft', lotId: '', quantity: '', unit: '', notes: '' }),
    );
    renderSheet();
    expect(screen.getByPlaceholderText('What work was done?')).toHaveValue('Old draft');

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

    expect(screen.getByPlaceholderText('What work was done?')).toHaveValue('');
    expect(screen.queryByText(/draft restored/i)).not.toBeInTheDocument();
    expect(readSessionStorageItem(KEY)).toBeNull();
  });

  it('never restores or writes drafts when editing an existing entry', () => {
    writeSessionStorageItem(
      KEY,
      JSON.stringify({ description: 'Fresh draft', lotId: '', quantity: '', unit: '', notes: '' }),
    );
    const { view } = renderSheet({ initialData: { description: 'Existing entry' } });

    expect(screen.getByPlaceholderText('What work was done?')).toHaveValue('Existing entry');
    expect(screen.queryByText(/draft restored/i)).not.toBeInTheDocument();

    view.unmount();
    // The stored fresh-entry draft is untouched by the edit session.
    expect(JSON.parse(readSessionStorageItem(KEY)!)).toMatchObject({ description: 'Fresh draft' });
  });

  it('appends dictated speech to the notes field when the mic is supported', () => {
    renderSheet();
    fireEvent.click(screen.getByText('More details'));

    fireEvent.click(screen.getByRole('button', { name: 'Dictate' }));

    const notes = screen.getAllByRole('textbox').find((el) => el.tagName === 'TEXTAREA');
    expect(notes).toHaveValue('compacted to spec');
  });
});

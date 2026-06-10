/**
 * Shared auto-draft mechanism for the diary bottom sheets.
 *
 * Field research: every form fill on site WILL be interrupted. These tests pin
 * the contract that makes dismissal safe: typed state persists (debounced
 * while typing, flushed synchronously on unmount), restores on reopen with a
 * dismissible hint, clears on successful save, and auto-populated baseline
 * values never create phantom drafts.
 *
 * All storage access — in the mechanism AND in these tests — goes through the
 * safe @/lib/storagePreferences helpers (the readiness guardrail scans tests
 * too).
 */

import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen } from '@/test/renderWithProviders';
import {
  readSessionStorageItem,
  removeSessionStorageItem,
  writeSessionStorageItem,
} from '@/lib/storagePreferences';
import { SheetDraftRestoredHint } from './SheetDraftRestoredHint';
import {
  isSheetDraftPristine,
  readSheetDraft,
  sheetDraftKey,
  useSheetDraft,
} from './useSheetDraft';

const KEY = sheetDraftKey('proj-1', '2026-06-10', 'activity');

function DraftHarness({
  draftKey,
  baselineValue = '',
}: {
  draftKey?: string;
  baselineValue?: string;
}) {
  const [restored] = useState(() => readSheetDraft(draftKey));
  const [value, setValue] = useState(restored?.value ?? baselineValue);
  const draft = useSheetDraft({
    draftKey,
    restored,
    fields: { value },
    baseline: { value: baselineValue },
  });
  return (
    <div>
      {draft.draftHintVisible && (
        <SheetDraftRestoredHint
          onDiscard={() => {
            setValue(baselineValue);
            draft.discardDraft();
          }}
          onDismiss={draft.dismissDraftHint}
        />
      )}
      <input aria-label="Value" value={value} onChange={(e) => setValue(e.target.value)} />
      <button type="button" onClick={draft.clearDraft}>
        Simulate save success
      </button>
    </div>
  );
}

beforeEach(() => {
  removeSessionStorageItem(KEY);
});

afterEach(() => {
  removeSessionStorageItem(KEY);
  vi.useRealTimers();
});

describe('sheetDraftKey', () => {
  it('scopes drafts per project + diary date + sheet type', () => {
    expect(sheetDraftKey('proj-1', '2026-06-10', 'activity')).toBe(
      'siteproof_diary_sheet_draft:proj-1:2026-06-10:activity',
    );
  });
});

describe('readSheetDraft', () => {
  it('returns null for a missing key, disabled drafting, or invalid payloads', () => {
    expect(readSheetDraft(undefined)).toBeNull();
    expect(readSheetDraft(KEY)).toBeNull();

    writeSessionStorageItem(KEY, 'not json');
    expect(readSheetDraft(KEY)).toBeNull();

    writeSessionStorageItem(KEY, JSON.stringify({ value: 5 }));
    expect(readSheetDraft(KEY)).toBeNull();

    writeSessionStorageItem(KEY, JSON.stringify(['array']));
    expect(readSheetDraft(KEY)).toBeNull();
  });
});

describe('isSheetDraftPristine', () => {
  it('treats auto-populated baseline values as pristine, not as a draft', () => {
    expect(isSheetDraftPristine({ lotId: 'lot-1' }, { lotId: 'lot-1' })).toBe(true);
    expect(isSheetDraftPristine({ lotId: 'lot-2' }, { lotId: 'lot-1' })).toBe(false);
    expect(isSheetDraftPristine({ description: '' }, {})).toBe(true);
    expect(isSheetDraftPristine({}, { description: 'x' })).toBe(false);
  });
});

describe('useSheetDraft', () => {
  it('persists typed state debounced while the user types', () => {
    vi.useFakeTimers();
    renderWithProviders(<DraftHarness draftKey={KEY} />);

    fireEvent.change(screen.getByLabelText('Value'), { target: { value: 'poured slab' } });
    expect(readSessionStorageItem(KEY)).toBeNull();

    vi.advanceTimersByTime(400);
    expect(JSON.parse(readSessionStorageItem(KEY)!)).toEqual({ value: 'poured slab' });
  });

  it('never writes a phantom draft for untouched auto-populated fields', () => {
    vi.useFakeTimers();
    const { unmount } = renderWithProviders(
      <DraftHarness draftKey={KEY} baselineValue="auto-populated" />,
    );

    vi.advanceTimersByTime(1000);
    expect(readSessionStorageItem(KEY)).toBeNull();

    // Dismissal without typing leaves no draft either.
    unmount();
    expect(readSessionStorageItem(KEY)).toBeNull();
  });

  it('removes the draft when the user hand-clears fields back to baseline', () => {
    vi.useFakeTimers();
    renderWithProviders(<DraftHarness draftKey={KEY} />);

    fireEvent.change(screen.getByLabelText('Value'), { target: { value: 'typed' } });
    vi.advanceTimersByTime(400);
    expect(readSessionStorageItem(KEY)).not.toBeNull();

    fireEvent.change(screen.getByLabelText('Value'), { target: { value: '' } });
    vi.advanceTimersByTime(400);
    expect(readSessionStorageItem(KEY)).toBeNull();
  });

  it('flushes the pending draft synchronously on unmount (overlay-tap dismissal)', () => {
    const { unmount } = renderWithProviders(<DraftHarness draftKey={KEY} />);

    fireEvent.change(screen.getByLabelText('Value'), { target: { value: 'interrupted entry' } });
    // No debounce wait: the dismissal itself must not cost the keystrokes.
    unmount();

    expect(JSON.parse(readSessionStorageItem(KEY)!)).toEqual({ value: 'interrupted entry' });
  });

  it('restores the draft on reopen and shows the dismissible hint', () => {
    writeSessionStorageItem(KEY, JSON.stringify({ value: 'restored entry' }));
    renderWithProviders(<DraftHarness draftKey={KEY} />);

    expect(screen.getByLabelText('Value')).toHaveValue('restored entry');
    expect(screen.getByText(/draft restored/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss draft restored hint' }));
    expect(screen.queryByText(/draft restored/i)).not.toBeInTheDocument();
    // Dismissing the hint keeps the draft — only discard/save clear it.
    expect(readSessionStorageItem(KEY)).not.toBeNull();
  });

  it('shows no hint when there is no stored draft', () => {
    renderWithProviders(<DraftHarness draftKey={KEY} />);
    expect(screen.queryByText(/draft restored/i)).not.toBeInTheDocument();
  });

  it('clearDraft (save success) removes the draft and disarms the unmount flush', () => {
    vi.useFakeTimers();
    const { unmount } = renderWithProviders(<DraftHarness draftKey={KEY} />);

    fireEvent.change(screen.getByLabelText('Value'), { target: { value: 'saved entry' } });
    vi.advanceTimersByTime(400);
    expect(readSessionStorageItem(KEY)).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Simulate save success' }));
    expect(readSessionStorageItem(KEY)).toBeNull();

    // The unmount flush must not resurrect the entry that was just recorded.
    unmount();
    expect(readSessionStorageItem(KEY)).toBeNull();
  });

  it('clearDraft cancels a pending debounced write (fast queued-offline save)', () => {
    vi.useFakeTimers();
    renderWithProviders(<DraftHarness draftKey={KEY} />);

    fireEvent.change(screen.getByLabelText('Value'), { target: { value: 'queued entry' } });
    // Save resolves before the debounce window elapses.
    fireEvent.click(screen.getByRole('button', { name: 'Simulate save success' }));
    vi.advanceTimersByTime(1000);

    expect(readSessionStorageItem(KEY)).toBeNull();
  });

  it('re-arms after clearDraft when the user keeps typing', () => {
    vi.useFakeTimers();
    renderWithProviders(<DraftHarness draftKey={KEY} />);

    fireEvent.change(screen.getByLabelText('Value'), { target: { value: 'first entry' } });
    vi.advanceTimersByTime(400);
    fireEvent.click(screen.getByRole('button', { name: 'Simulate save success' }));
    expect(readSessionStorageItem(KEY)).toBeNull();

    fireEvent.change(screen.getByLabelText('Value'), { target: { value: 'second entry' } });
    vi.advanceTimersByTime(400);
    expect(JSON.parse(readSessionStorageItem(KEY)!)).toEqual({ value: 'second entry' });
  });

  it('discard clears the stored draft and hides the hint', () => {
    writeSessionStorageItem(KEY, JSON.stringify({ value: 'unwanted draft' }));
    renderWithProviders(<DraftHarness draftKey={KEY} />);

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

    expect(screen.getByLabelText('Value')).toHaveValue('');
    expect(screen.queryByText(/draft restored/i)).not.toBeInTheDocument();
    expect(readSessionStorageItem(KEY)).toBeNull();
  });

  it('does nothing without a draft key (drafting disabled)', () => {
    const { unmount } = renderWithProviders(<DraftHarness />);

    fireEvent.change(screen.getByLabelText('Value'), { target: { value: 'edit of an entry' } });
    unmount();

    expect(readSessionStorageItem(KEY)).toBeNull();
  });
});

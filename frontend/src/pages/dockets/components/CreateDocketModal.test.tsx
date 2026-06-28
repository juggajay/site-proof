import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CreateDocketModal } from './CreateDocketModal';

// Render through the desktop (modal) path so tests don't need to set up
// BottomSheet animation expectations. Individual ResponsiveSheet tests
// cover the mobile branch.
vi.mock('@/hooks/useMediaQuery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useMediaQuery')>();
  return { ...actual, useIsMobile: () => false };
});

// VoiceInputButton wraps browser SpeechRecognition; stub it with a button that
// emits a fixed transcript so the notes append behavior can be asserted.
vi.mock('@/components/ui/VoiceInputButton', () => ({
  VoiceInputButton: ({ onTranscript }: { onTranscript: (text: string) => void }) => (
    <button type="button" onClick={() => onTranscript('site cleared')}>
      voice-input-stub
    </button>
  ),
}));

function renderModal(overrides: Partial<Parameters<typeof CreateDocketModal>[0]> = {}) {
  const props = {
    date: '',
    onDateChange: vi.fn(),
    notes: '',
    onNotesChange: vi.fn(),
    creating: false,
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  };
  const view = render(<CreateDocketModal {...props} />);
  return { props, view };
}

describe('CreateDocketModal', () => {
  it('renders the dialog with all field labels', () => {
    renderModal();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Create Docket' })).toBeInTheDocument();
    expect(screen.getByLabelText('Date *')).toBeInTheDocument();
    expect(screen.queryByLabelText('Labour Hours')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Plant Hours')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
  });

  it('disables Create Docket until a date is set and while creating', () => {
    const { view } = renderModal();
    expect(screen.getByRole('button', { name: 'Create Docket' })).toBeDisabled();

    view.rerender(
      <CreateDocketModal
        date="2026-06-04"
        onDateChange={vi.fn()}
        notes=""
        onNotesChange={vi.fn()}
        creating={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Create Docket' })).toBeEnabled();

    view.rerender(
      <CreateDocketModal
        date="2026-06-04"
        onDateChange={vi.fn()}
        notes=""
        onNotesChange={vi.fn()}
        creating={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Creating...' })).toBeDisabled();
  });

  it('submits via onSubmit and closes via the Cancel button', () => {
    const { props } = renderModal({ date: '2026-06-04' });

    fireEvent.click(screen.getByRole('button', { name: 'Create Docket' }));
    expect(props.onSubmit).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('reports field edits through the controlled-value callbacks', () => {
    const { props } = renderModal();

    fireEvent.change(screen.getByLabelText('Date *'), { target: { value: '2026-06-04' } });
    expect(props.onDateChange).toHaveBeenCalledWith('2026-06-04');

    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'wet morning' } });
    expect(props.onNotesChange).toHaveBeenCalledWith('wet morning');
  });

  it('appends voice transcripts to existing notes via a functional update', () => {
    const onNotesChange = vi.fn();
    renderModal({ onNotesChange });

    fireEvent.click(screen.getByRole('button', { name: 'voice-input-stub' }));

    expect(onNotesChange).toHaveBeenCalledTimes(1);
    const updater = onNotesChange.mock.calls[0][0] as (prev: string) => string;
    expect(updater('')).toBe('site cleared');
    expect(updater('existing note')).toBe('existing note site cleared');
  });
});

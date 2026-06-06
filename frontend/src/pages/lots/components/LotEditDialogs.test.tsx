import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LotEditDialogs } from './LotEditDialogs';

afterEach(() => {
  cleanup();
});

function renderDialogs(overrides: Partial<Parameters<typeof LotEditDialogs>[0]> = {}) {
  const props = {
    showUnsavedDialog: false,
    onCancelLeave: vi.fn(),
    onConfirmLeave: vi.fn(),
    showConcurrentEditWarning: false,
    serverUpdatedAt: null,
    onCloseConcurrentWarning: vi.fn(),
    onRefreshPage: vi.fn(),
    ...overrides,
  };
  render(<LotEditDialogs {...props} />);
  return props;
}

describe('LotEditDialogs', () => {
  it('renders no dialogs by default', () => {
    renderDialogs();

    expect(screen.queryByText('Unsaved Changes')).not.toBeInTheDocument();
    expect(screen.queryByText('Concurrent Edit Detected')).not.toBeInTheDocument();
  });

  it('forwards unsaved-change cancel and leave actions', () => {
    const props = renderDialogs({ showUnsavedDialog: true });

    fireEvent.click(screen.getByRole('button', { name: 'Stay on Page' }));
    expect(props.onCancelLeave).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Leave Page' }));
    expect(props.onConfirmLeave).toHaveBeenCalledTimes(1);
  });

  it('shows concurrent edit details and forwards its actions', () => {
    const props = renderDialogs({
      showConcurrentEditWarning: true,
      serverUpdatedAt: '2026-06-06T10:30:00.000Z',
    });

    expect(screen.getByText('Concurrent Edit Detected')).toBeInTheDocument();
    expect(screen.getByText(/Last modified:/)).toHaveTextContent('06/06/2026');

    fireEvent.click(screen.getByRole('button', { name: 'Continue Editing' }));
    expect(props.onCloseConcurrentWarning).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh Page' }));
    expect(props.onRefreshPage).toHaveBeenCalledTimes(1);
  });
});

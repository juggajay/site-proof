import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  LotEditErrorState,
  LotEditFormActions,
  LotEditHeader,
  LotEditLoadingState,
  LotEditLockedWarning,
  LotEditSaveError,
} from './LotEditPageChrome';

describe('LotEditLoadingState', () => {
  it('renders the loading spinner shell', () => {
    const { container } = render(<LotEditLoadingState />);

    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });
});

describe('LotEditErrorState', () => {
  it('renders the error and sends users back', () => {
    const onGoBack = vi.fn();
    render(<LotEditErrorState error="Lot not found" onGoBack={onGoBack} />);

    expect(screen.getByRole('heading', { name: 'Error' })).toBeInTheDocument();
    expect(screen.getByText('Lot not found')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Go Back' }));
    expect(onGoBack).toHaveBeenCalledTimes(1);
  });
});

describe('LotEditHeader', () => {
  it('renders lot context and offline state', () => {
    const onCancel = vi.fn();
    render(
      <LotEditHeader
        lotNumber="LOT-001"
        offlineSyncStatus="pending"
        isOnline={false}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Edit Lot' })).toBeInTheDocument();
    expect(screen.getByText('Editing lot LOT-001')).toBeInTheDocument();
    expect(screen.getByText('Pending sync')).toBeInTheDocument();
    expect(screen.getByText('Offline Mode')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('LotEditLockedWarning', () => {
  it('renders the conformed-budget-only warning', () => {
    render(<LotEditLockedWarning detailsLocked canEditConformedBudget lotStatus="conformed" />);

    expect(
      screen.getByText(/Only the commercial budget can be edited on this conformed lot/),
    ).toBeInTheDocument();
  });

  it('renders the fully locked status warning', () => {
    render(
      <LotEditLockedWarning detailsLocked canEditConformedBudget={false} lotStatus="claimed" />,
    );

    expect(screen.getByText(/This lot is claimed and cannot be edited/)).toBeInTheDocument();
  });
});

describe('LotEditSaveError', () => {
  it('renders save validation errors only when present', () => {
    const { rerender } = render(<LotEditSaveError saveError={null} />);

    expect(screen.queryByText('Failed to save changes')).not.toBeInTheDocument();

    rerender(<LotEditSaveError saveError="Failed to save changes" />);

    expect(screen.getByText('Failed to save changes')).toBeInTheDocument();
  });
});

describe('LotEditFormActions', () => {
  it('renders cancel and enabled save controls', () => {
    const onCancel = vi.fn();
    render(<LotEditFormActions canSubmit saving={false} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
  });

  it('disables submit while saving or invalid', () => {
    render(<LotEditFormActions canSubmit={false} saving onCancel={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
  });
});

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LotDetailEmptyState,
  LotDetailErrorState,
  LotDetailLoadingState,
  type LotDetailPageError,
} from './LotDetailPageStates';

afterEach(() => {
  cleanup();
});

describe('LotDetailLoadingState', () => {
  it('renders an accessible loading status region', () => {
    render(<LotDetailLoadingState />);
    expect(screen.getByRole('status', { name: 'Loading lot details' })).toBeInTheDocument();
  });
});

describe('LotDetailErrorState', () => {
  const renderError = (type: LotDetailPageError['type'], message = 'Something went wrong') => {
    const onRetry = vi.fn();
    const onGoBack = vi.fn();
    render(<LotDetailErrorState error={{ type, message }} onRetry={onRetry} onGoBack={onGoBack} />);
    return { onRetry, onGoBack };
  };

  it('shows the Access Denied heading and no retry button for forbidden errors', () => {
    renderError('forbidden', 'You do not have access to this lot');

    expect(screen.getByRole('heading', { name: 'Access Denied' })).toBeInTheDocument();
    expect(screen.getByText('You do not have access to this lot')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('shows the Lot Not Found heading and no retry button for not_found errors', () => {
    renderError('not_found', 'That lot no longer exists');

    expect(screen.getByRole('heading', { name: 'Lot Not Found' })).toBeInTheDocument();
    expect(screen.getByText('That lot no longer exists')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('shows the Error heading and a retry button for generic errors', () => {
    renderError('error', 'Unexpected failure');

    expect(screen.getByRole('heading', { name: 'Error' })).toBeInTheDocument();
    expect(screen.getByText('Unexpected failure')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('calls onRetry when the retry button is clicked', () => {
    const { onRetry, onGoBack } = renderError('error');

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onGoBack).not.toHaveBeenCalled();
  });

  it('calls onGoBack when the Go Back button is clicked (always rendered)', () => {
    const { onRetry, onGoBack } = renderError('forbidden');

    fireEvent.click(screen.getByRole('button', { name: 'Go Back' }));

    expect(onGoBack).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });
});

describe('LotDetailEmptyState', () => {
  it('renders nothing', () => {
    const { container } = render(<LotDetailEmptyState />);
    expect(container).toBeEmptyDOMElement();
  });
});

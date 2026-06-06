import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import {
  ClaimsAccessDeniedState,
  ClaimsLoadErrorAlert,
  ClaimsLoadingState,
  ClaimsPageHeader,
} from './ClaimsPageSections';

describe('ClaimsPageHeader', () => {
  it('hides CSV export when there are no claims', () => {
    render(<ClaimsPageHeader claimCount={0} onExportCSV={vi.fn()} onCreateClaim={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Progress Claims' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Claim' })).toBeInTheDocument();
  });

  it('calls header actions when claims exist', async () => {
    const onExportCSV = vi.fn();
    const onCreateClaim = vi.fn();
    const user = userEvent.setup();

    render(
      <ClaimsPageHeader claimCount={2} onExportCSV={onExportCSV} onCreateClaim={onCreateClaim} />,
    );

    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    await user.click(screen.getByRole('button', { name: 'New Claim' }));

    expect(onExportCSV).toHaveBeenCalledTimes(1);
    expect(onCreateClaim).toHaveBeenCalledTimes(1);
  });
});

describe('ClaimsLoadErrorAlert', () => {
  it('renders nothing without an error', () => {
    const { container } = render(<ClaimsLoadErrorAlert loadError={null} onRetry={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('calls retry from the load error alert', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();

    render(<ClaimsLoadErrorAlert loadError="Could not load claims." onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load claims.');
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('ClaimsLoadingState', () => {
  it('renders the loading spinner shell', () => {
    const { container } = render(<ClaimsLoadingState />);

    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });
});

describe('ClaimsAccessDeniedState', () => {
  it('passes through the access denied message', () => {
    render(
      <MemoryRouter>
        <ClaimsAccessDeniedState message="Claims are not available for this project." />
      </MemoryRouter>,
    );

    expect(screen.getByText('Claims are not available for this project.')).toBeInTheDocument();
  });
});

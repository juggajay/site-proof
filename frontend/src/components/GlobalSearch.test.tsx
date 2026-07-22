import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { GlobalSearch } from './GlobalSearch';

const openClancyMock = vi.hoisted(() => vi.fn());
const clancyEnabled = vi.hoisted(() => ({ value: true }));

vi.mock('@/components/copilot/clancyAccess', () => ({
  useClancyEnabled: () => clancyEnabled.value,
}));
vi.mock('@/components/copilot/clancyChatState', () => ({
  openClancy: openClancyMock,
}));

function renderSearch(onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <GlobalSearch isOpen onClose={onClose} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return onClose;
}

describe('GlobalSearch Ask Clancy row', () => {
  it('closes the palette and opens the Clancy drawer when clicked', () => {
    openClancyMock.mockReset();
    const onClose = renderSearch();

    fireEvent.click(screen.getByText('Ask Clancy…'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(openClancyMock).toHaveBeenCalledTimes(1);
  });

  it('is hidden for roles without Clancy access', () => {
    clancyEnabled.value = false;
    renderSearch();
    expect(screen.queryByText('Ask Clancy…')).not.toBeInTheDocument();
    clancyEnabled.value = true;
  });
});

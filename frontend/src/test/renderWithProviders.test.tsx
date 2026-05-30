import { describe, expect, it } from 'vitest';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  createTestQueryClient,
  fireEvent,
  renderWithProviders,
  screen,
} from './renderWithProviders';

function QueryProbe() {
  const { data, isLoading } = useQuery({
    queryKey: ['probe-greeting'],
    queryFn: () => Promise.resolve('hello from query'),
  });

  return <p>{isLoading ? 'loading' : data}</p>;
}

function LocationProbe() {
  const location = useLocation();

  return <p>path: {location.pathname}</p>;
}

function NavigationProbe() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div>
      <p>path: {location.pathname}</p>
      <button type="button" onClick={() => navigate('/destination')}>
        Go
      </button>
    </div>
  );
}

describe('renderWithProviders', () => {
  it('provides a QueryClient so useQuery can resolve', async () => {
    renderWithProviders(<QueryProbe />);

    expect(await screen.findByText('hello from query')).toBeInTheDocument();
  });

  it('mounts a MemoryRouter seeded from initialEntries', () => {
    renderWithProviders(<LocationProbe />, { initialEntries: ['/lots/42'] });

    expect(screen.getByText('path: /lots/42')).toBeInTheDocument();
  });

  it('supports navigation inside the router', () => {
    renderWithProviders(<NavigationProbe />, { initialEntries: ['/start'] });

    expect(screen.getByText('path: /start')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Go' }));

    expect(screen.getByText('path: /destination')).toBeInTheDocument();
  });

  it('reuses a caller-supplied QueryClient and returns it', () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(['probe-greeting'], 'primed from cache');

    const result = renderWithProviders(<QueryProbe />, { queryClient });

    expect(result.queryClient).toBe(queryClient);
    expect(screen.getByText('primed from cache')).toBeInTheDocument();
  });
});

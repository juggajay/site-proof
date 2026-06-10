import { useSearchParams } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';
import type { NCR } from '../types';
import { NCRFilters } from './NCRFilters';

function buildNcr(overrides: Partial<NCR> & { id: string }): NCR {
  return {
    ncrNumber: `NCR-${overrides.id}`,
    description: 'Test NCR',
    category: 'workmanship',
    severity: 'minor',
    status: 'open',
    qmApprovalRequired: false,
    qmApprovedAt: null,
    raisedBy: { fullName: 'Inspector', email: 'inspector@example.com' },
    createdAt: '2026-05-01T00:00:00.000Z',
    project: { name: 'Project', projectNumber: 'P-1' },
    ncrLots: [],
    ...overrides,
  };
}

const OPEN_NCR = buildNcr({ id: 'open-1', status: 'open', category: 'workmanship' });
const CLOSED_NCR = buildNcr({ id: 'closed-1', status: 'closed', category: 'materials' });
const REGISTER = [OPEN_NCR, CLOSED_NCR];

/** Exposes the live query string so tests can assert URL round-trips. */
function SearchParamsProbe() {
  const [searchParams] = useSearchParams();
  return <div data-testid="search-params">{searchParams.toString()}</div>;
}

function renderFilters({ initialEntry = '/projects/p1/ncr' }: { initialEntry?: string } = {}) {
  const onFilteredNcrsChange = vi.fn();
  const view = renderWithProviders(
    <>
      <NCRFilters ncrs={REGISTER} isMobile={false} onFilteredNcrsChange={onFilteredNcrsChange} />
      <SearchParamsProbe />
    </>,
    { initialEntries: [initialEntry] },
  );
  const lastFiltered = (): NCR[] => onFilteredNcrsChange.mock.calls.at(-1)?.[0] ?? [];
  return { ...view, onFilteredNcrsChange, lastFiltered };
}

describe('NCRFilters URL persistence', () => {
  it('applies filters carried in the URL on first render', async () => {
    const { lastFiltered } = renderFilters({ initialEntry: '/projects/p1/ncr?status=open' });

    await waitFor(() => expect(lastFiltered().map((ncr) => ncr.id)).toEqual(['open-1']));
    expect(screen.getByLabelText('Status')).toHaveValue('open');
    expect(screen.getByText('Showing 1 of 2 NCRs')).toBeInTheDocument();
  });

  it('writes filter changes to the URL so navigation keeps them', async () => {
    const { lastFiltered } = renderFilters();

    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'materials' } });

    expect(screen.getByTestId('search-params')).toHaveTextContent('category=materials');
    await waitFor(() => expect(lastFiltered().map((ncr) => ncr.id)).toEqual(['closed-1']));
  });

  it('round-trips: a URL produced by a filter change re-applies the same filter', async () => {
    const first = renderFilters();
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'closed' } });
    const persistedSearch = screen.getByTestId('search-params').textContent ?? '';
    first.unmount();

    const { lastFiltered } = renderFilters({
      initialEntry: `/projects/p1/ncr?${persistedSearch}`,
    });

    await waitFor(() => expect(lastFiltered().map((ncr) => ncr.id)).toEqual(['closed-1']));
    expect(screen.getByLabelText('Status')).toHaveValue('closed');
  });

  it('clears its own params but preserves reserved ones (deep link, sort)', async () => {
    renderFilters({
      initialEntry: '/projects/p1/ncr?status=open&from=2026-05-01&ncr=abc&sort=due&dir=desc',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));

    const params = new URLSearchParams(screen.getByTestId('search-params').textContent ?? '');
    expect(params.get('status')).toBeNull();
    expect(params.get('from')).toBeNull();
    expect(params.get('ncr')).toBe('abc');
    expect(params.get('sort')).toBe('due');
    expect(params.get('dir')).toBe('desc');
  });
});

import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast } from '@/components/ui/toaster';
import { useRegisterDeepLink } from './useRegisterDeepLink';

vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));

interface FakeRecord {
  id: string;
  label: string;
}

const getRecordId = (record: FakeRecord) => record.id;
const NOT_FOUND = {
  title: "Couldn't find that record",
  description: 'It may belong to another project.',
};

const RECORDS: FakeRecord[] = [
  { id: 'rec-1', label: 'First' },
  { id: 'rec-2', label: 'Second' },
];

function Harness({ loading, records }: { loading: boolean; records: FakeRecord[] }) {
  const { highlightedId } = useRegisterDeepLink({
    param: 'hp',
    loading,
    records,
    getRecordId,
    notFound: NOT_FOUND,
  });
  const [searchParams] = useSearchParams();
  return (
    <div
      data-testid="probe"
      data-highlighted={highlightedId ?? ''}
      data-search={searchParams.toString()}
    />
  );
}

function renderHarness({
  initialEntry = '/hold-points?hp=rec-2',
  loading = false,
  records = RECORDS,
}: { initialEntry?: string; loading?: boolean; records?: FakeRecord[] } = {}) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Harness loading={loading} records={records} />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('useRegisterDeepLink', () => {
  it('highlights the linked record and clears the param once data has loaded', () => {
    renderHarness();

    const probe = screen.getByTestId('probe');
    expect(probe).toHaveAttribute('data-highlighted', 'rec-2');
    expect(probe).toHaveAttribute('data-search', '');
    expect(toast).not.toHaveBeenCalled();
  });

  it('waits for data before handling the param', () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/hold-points?hp=rec-2']}>
        <Harness loading records={[]} />
      </MemoryRouter>,
    );

    const probe = screen.getByTestId('probe');
    expect(probe).toHaveAttribute('data-highlighted', '');
    expect(probe).toHaveAttribute('data-search', 'hp=rec-2');

    rerender(
      <MemoryRouter initialEntries={['/hold-points?hp=rec-2']}>
        <Harness loading={false} records={RECORDS} />
      </MemoryRouter>,
    );

    expect(probe).toHaveAttribute('data-highlighted', 'rec-2');
    expect(probe).toHaveAttribute('data-search', '');
    expect(toast).not.toHaveBeenCalled();
  });

  it('shows a not-found toast and clears the param for an unknown id', () => {
    renderHarness({ initialEntry: '/hold-points?hp=rec-unknown' });

    const probe = screen.getByTestId('probe');
    expect(probe).toHaveAttribute('data-highlighted', '');
    expect(probe).toHaveAttribute('data-search', '');
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith({
      title: NOT_FOUND.title,
      description: NOT_FOUND.description,
      variant: 'error',
    });
  });

  it('preserves unrelated params when clearing its own', () => {
    renderHarness({ initialEntry: '/hold-points?hp=rec-1&tab=details' });

    expect(screen.getByTestId('probe')).toHaveAttribute('data-search', 'tab=details');
  });

  it('does nothing when the param is absent', () => {
    renderHarness({ initialEntry: '/hold-points' });

    const probe = screen.getByTestId('probe');
    expect(probe).toHaveAttribute('data-highlighted', '');
    expect(toast).not.toHaveBeenCalled();
  });

  it('clears the highlight after the pulse', () => {
    vi.useFakeTimers();
    renderHarness();

    const probe = screen.getByTestId('probe');
    expect(probe).toHaveAttribute('data-highlighted', 'rec-2');

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(probe).toHaveAttribute('data-highlighted', '');
  });
});

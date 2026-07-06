import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LinkItpItemModal } from './LinkItpItemModal';
import type { TestResult } from '../types';

vi.mock('@/components/foreman/sheets/BottomSheet', () => ({
  BottomSheet: ({
    isOpen,
    title,
    children,
  }: {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
  }) =>
    isOpen ? (
      <div data-testid="bottom-sheet" role="dialog" aria-modal="true" aria-label={title}>
        {children}
      </div>
    ) : null,
}));

const useIsMobileMock = vi.hoisted(() => vi.fn(() => false));
vi.mock('@/hooks/useMediaQuery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useMediaQuery')>();
  return { ...actual, useIsMobile: useIsMobileMock };
});

const useLotItpTestItemsMock = vi.hoisted(() =>
  vi.fn(() => ({
    items: [] as { id: string; description: string; testType: string | null }[],
    isLoading: false,
  })),
);
vi.mock('../hooks/useLotItpTestItems', () => ({
  useLotItpTestItems: useLotItpTestItemsMock,
}));

const apiFetchMock = vi.hoisted(() => vi.fn().mockResolvedValue({}));
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: apiFetchMock };
});

function makeTest(overrides: Partial<TestResult> = {}): TestResult {
  return {
    id: 'test-1',
    testType: 'Density Ratio',
    testRequestNumber: null,
    laboratoryName: null,
    laboratoryReportNumber: null,
    sampleDate: null,
    sampleLocation: null,
    testDate: null,
    resultDate: null,
    resultValue: null,
    resultUnit: null,
    specificationMin: null,
    specificationMax: null,
    passFail: 'pending',
    status: 'requested',
    lotId: 'lot-1',
    lot: { id: 'lot-1', lotNumber: 'L-001' },
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useIsMobileMock.mockReturnValue(false);
  useLotItpTestItemsMock.mockReturnValue({ items: [], isLoading: false });
});

describe('LinkItpItemModal', () => {
  it('PATCHes the chosen ITP item id onto the test and refreshes', async () => {
    const user = userEvent.setup();
    useLotItpTestItemsMock.mockReturnValue({
      items: [{ id: 'chk-1', description: 'Subgrade density', testType: 'Density Ratio' }],
      isLoading: false,
    });
    const onLinked = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(<LinkItpItemModal isOpen test={makeTest()} onClose={onClose} onLinked={onLinked} />);

    // Confirm is disabled until an item is chosen
    expect(screen.getByRole('button', { name: /Link item/i })).toBeDisabled();

    await user.selectOptions(screen.getByLabelText(/Requirement this test satisfies/i), 'chk-1');
    await user.click(screen.getByRole('button', { name: /Link item/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/test-results/test-1', {
        method: 'PATCH',
        body: JSON.stringify({ itpChecklistItemId: 'chk-1' }),
      });
    });
    expect(onLinked).toHaveBeenCalledWith('lot-1');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows an empty state when the lot ITP has no test-required items', () => {
    useLotItpTestItemsMock.mockReturnValue({ items: [], isLoading: false });
    render(<LinkItpItemModal isOpen test={makeTest()} onClose={vi.fn()} onLinked={vi.fn()} />);

    expect(screen.getByText(/no test-required items/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Link item/i })).toBeDisabled();
  });
});

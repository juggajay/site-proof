import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CreateTestModal } from './CreateTestModal';
import type { Lot } from '../types';

// ── Mock BottomSheet so the module graph is light (desktop path renders Modal) ──
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

// ── Desktop by default so ResponsiveSheet renders the Modal ──
const useIsMobileMock = vi.hoisted(() => vi.fn(() => false));
vi.mock('@/hooks/useMediaQuery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useMediaQuery')>();
  return { ...actual, useIsMobile: useIsMobileMock };
});

// ── Control the lot ITP items hook ──
const useLotItpTestItemsMock = vi.hoisted(() =>
  vi.fn(() => ({
    items: [] as { id: string; description: string; testType: string | null }[],
    isLoading: false,
  })),
);
vi.mock('../hooks/useLotItpTestItems', () => ({
  useLotItpTestItems: useLotItpTestItemsMock,
}));

const LOTS: Lot[] = [{ id: 'lot-1', lotNumber: 'L-001' }];
const TODAY = new Date().toISOString().slice(0, 10);

beforeEach(() => {
  vi.clearAllMocks();
  useIsMobileMock.mockReturnValue(false);
  useLotItpTestItemsMock.mockReturnValue({ items: [], isLoading: false });
});

function renderModal(props: Partial<React.ComponentProps<typeof CreateTestModal>> = {}) {
  const onSuccess = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(
    <CreateTestModal
      isOpen
      onClose={onClose}
      onSuccess={onSuccess}
      lots={LOTS}
      projectState="NSW"
      {...props}
    />,
  );
  return { onSuccess, onClose };
}

describe('CreateTestModal — slim create form', () => {
  it('does not render the result-block fields (Result Value / Pass-Fail / Spec Min-Max)', () => {
    renderModal();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Result Value/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Pass\/Fail Status/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Pass/Fail Status')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Spec Min/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Spec Max/i)).not.toBeInTheDocument();
  });

  it('hides lab & sample details behind the accordion until expanded', async () => {
    const user = userEvent.setup();
    renderModal();

    // Trigger is present but details are collapsed initially
    const trigger = screen.getByRole('button', { name: /Add lab & sample details/i });
    expect(trigger).toBeInTheDocument();
    expect(screen.queryByLabelText(/Laboratory Name/i)).not.toBeInTheDocument();

    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByLabelText(/Laboratory Name/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/Lab Report Number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Specification Reference/i)).toBeInTheDocument();
  });

  it('defaults Sample Date to today', () => {
    renderModal();
    expect(screen.getByLabelText(/Sample Date/i)).toHaveValue(TODAY);
  });

  it('submits the free-text Test Type for the no-lot case (no itpChecklistItemId)', async () => {
    const user = userEvent.setup();
    const { onSuccess } = renderModal();

    await user.type(screen.getByLabelText(/Test Type/i), 'CBR Laboratory');
    await user.click(screen.getByRole('button', { name: /Create Test Result/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    const payload = onSuccess.mock.calls[0][0];
    expect(payload.testType).toBe('CBR Laboratory');
    expect(payload.itpChecklistItemId).toBeUndefined();
  });

  it('shows the satisfiesItem banner and always submits its item id', async () => {
    const user = userEvent.setup();
    const { onSuccess } = renderModal({
      satisfiesItem: { id: 'item-9', description: 'Compaction to 95% DDR' },
      initialValues: { testType: 'Density Ratio' },
    });

    expect(screen.getByText(/This test will satisfy/i)).toHaveTextContent('Compaction to 95% DDR');
    // Free-text Test Type is prefilled from initialValues (picker is hidden)
    expect(screen.getByLabelText(/Test Type/i)).toHaveValue('Density Ratio');

    await user.click(screen.getByRole('button', { name: /Create Test Result/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    const payload = onSuccess.mock.calls[0][0];
    expect(payload.testType).toBe('Density Ratio');
    expect(payload.itpChecklistItemId).toBe('item-9');
  });

  it('renders the ITP-item picker when the lot has test-required items and submits the chosen id', async () => {
    const user = userEvent.setup();
    useLotItpTestItemsMock.mockReturnValue({
      items: [{ id: 'chk-1', description: 'Subgrade density', testType: 'Density Ratio' }],
      isLoading: false,
    });
    const { onSuccess } = renderModal();

    // Choose the lot → picker appears (watch('lotId') drives it)
    await user.selectOptions(screen.getByLabelText(/Link to Lot/i), 'lot-1');

    const picker = await screen.findByRole('combobox', { name: 'Test Type' });
    await user.selectOptions(picker, 'chk-1');

    await user.click(screen.getByRole('button', { name: /Create Test Result/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    const payload = onSuccess.mock.calls[0][0];
    expect(payload.testType).toBe('Density Ratio');
    expect(payload.itpChecklistItemId).toBe('chk-1');
  });
});

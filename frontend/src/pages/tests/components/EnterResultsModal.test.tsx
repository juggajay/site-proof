import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { EnterResultsModal } from './EnterResultsModal';
import type { TestResult } from '../types';

// ── Mock BottomSheet so mobile-path tests don't need full animation setup ──
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
        <div data-testid="bottom-sheet-title">{title}</div>
        {children}
      </div>
    ) : null,
}));

// ── useIsMobile control ──
const useIsMobileMock = vi.hoisted(() => vi.fn(() => false));

vi.mock('@/hooks/useMediaQuery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useMediaQuery')>();
  return { ...actual, useIsMobile: useIsMobileMock };
});

function makeTest(overrides: Partial<TestResult> = {}): TestResult {
  return {
    id: 'test-1',
    testType: 'Density Ratio',
    testRequestNumber: 'TR-001',
    laboratoryName: 'Test Lab',
    laboratoryReportNumber: 'LAB-001',
    sampleDate: '2026-05-01',
    sampleLocation: 'CH 100.000',
    testDate: '2026-05-02',
    resultDate: '2026-05-03',
    resultValue: null,
    resultUnit: null,
    specificationMin: null,
    specificationMax: null,
    passFail: 'pending',
    status: 'results_received',
    lotId: null,
    lot: null,
    aiExtracted: false,
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
    ...overrides,
  };
}

describe('EnterResultsModal — desktop', () => {
  beforeEach(() => {
    useIsMobileMock.mockReturnValue(false);
  });

  it('renders a dialog with accessible title on desktop when open', () => {
    render(
      <EnterResultsModal isOpen={true} test={makeTest()} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    // ResponsiveSheet renders a Modal on desktop — the dialog node with the title heading
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Enter Results' })).toBeInTheDocument();
    // All required form fields present
    expect(screen.getByLabelText(/Result Value/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Unit/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Spec Min/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Spec Max/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Pass\/Fail Status/i)).toBeInTheDocument();
  });

  it('renders nothing when isOpen is false on desktop', () => {
    render(
      <EnterResultsModal isOpen={false} test={makeTest()} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders nothing when test is null on desktop', () => {
    render(<EnterResultsModal isOpen={true} test={null} onClose={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <EnterResultsModal isOpen={true} test={makeTest()} onClose={onClose} onSubmit={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('submit button is disabled when result value is empty', () => {
    render(
      <EnterResultsModal isOpen={true} test={makeTest()} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /Save & Enter Results/i })).toBeDisabled();
  });

  it('seeds the form from an existing test result', () => {
    render(
      <EnterResultsModal
        isOpen={true}
        test={makeTest({
          resultValue: 98.2,
          resultUnit: '% DDR',
          specificationMin: 95,
          passFail: 'pass',
        })}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/Result Value/i)).toHaveValue(98.2);
    expect(screen.getByLabelText(/Unit/i)).toHaveValue('% DDR');
    expect(screen.getByLabelText(/Spec Min/i)).toHaveValue(95);
  });

  it('calls onSubmit with form values when submitted', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <EnterResultsModal isOpen={true} test={makeTest()} onClose={onClose} onSubmit={onSubmit} />,
    );

    await user.type(screen.getByLabelText(/Result Value/i), '98.5');
    await user.type(screen.getByLabelText(/Unit/i), '%');
    // Manually set pass/fail to 'pass' since no spec bounds to auto-calc
    await user.selectOptions(screen.getByLabelText(/Pass\/Fail Status/i), 'pass');

    await user.click(screen.getByRole('button', { name: /Save & Enter Results/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce();
      const [testId, values] = onSubmit.mock.calls[0];
      expect(testId).toBe('test-1');
      expect(values.resultValue).toBe('98.5');
      expect(values.resultUnit).toBe('%');
      expect(values.passFail).toBe('pass');
    });
  });

  it('shows an error banner when onSubmit throws', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error('Network failure'));

    render(
      <EnterResultsModal isOpen={true} test={makeTest()} onClose={vi.fn()} onSubmit={onSubmit} />,
    );

    await user.type(screen.getByLabelText(/Result Value/i), '98.5');
    await user.selectOptions(screen.getByLabelText(/Pass\/Fail Status/i), 'pass');
    await user.click(screen.getByRole('button', { name: /Save & Enter Results/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Network failure/i);
    });
  });
});

describe('EnterResultsModal — mobile', () => {
  beforeEach(() => {
    useIsMobileMock.mockReturnValue(true);
  });

  it('renders a BottomSheet dialog named "Enter Results" on mobile when open', () => {
    render(
      <EnterResultsModal isOpen={true} test={makeTest()} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    // Exactly one dialog node (the BottomSheet stub), named by the title
    expect(screen.getByRole('dialog', { name: 'Enter Results' })).toBeInTheDocument();
    expect(screen.getByTestId('bottom-sheet')).toBeInTheDocument();
    // Form fields accessible inside the sheet
    expect(screen.getByLabelText(/Result Value/i)).toBeInTheDocument();
  });

  it('inputs have min-h-[44px] for touch target compliance', () => {
    render(
      <EnterResultsModal isOpen={true} test={makeTest()} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    const resultInput = screen.getByLabelText(/Result Value/i);
    expect(resultInput.className).toMatch(/min-h-\[44px\]/);
  });

  it('does not render when isOpen is false on mobile', () => {
    render(
      <EnterResultsModal isOpen={false} test={makeTest()} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    expect(screen.queryByTestId('bottom-sheet')).not.toBeInTheDocument();
  });
});

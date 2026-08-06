import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/renderWithProviders';
import { LotSelectionBar } from './LotSelectionBar';

type Props = Parameters<typeof LotSelectionBar>[0];

function renderBar(overrides: Partial<Props> = {}) {
  const props: Props = {
    selectedCount: 3,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    isSubcontractor: false,
    hasGoverningRuleset: true,
    rulesetLoadFailed: false,
    onRetryRulesetLoad: vi.fn(),
    onClearSelection: vi.fn(),
    onOpenBulkStatus: vi.fn(),
    onOpenBulkAssign: vi.fn(),
    onOpenBulkTestAttributes: vi.fn(),
    onOpenBulkDelete: vi.fn(),
    onOpenPrintLabels: vi.fn(),
    ...overrides,
  };
  const result = renderWithProviders(<LotSelectionBar {...props} />);
  return { ...result, props };
}

describe('LotSelectionBar', () => {
  it('stays out of the way until rows are selected', () => {
    renderBar({ selectedCount: 0 });
    expect(screen.queryByTestId('lot-selection-bar')).not.toBeInTheDocument();
  });

  it('shows the count and every bulk verb once rows are selected', () => {
    renderBar();

    expect(screen.getByTestId('lot-selection-count')).toHaveTextContent('3 selected');
    for (const name of [
      'Update Status',
      'Assign Subcontractor',
      'Set Testing Attributes',
      'Print Labels',
      'Delete Selected',
    ]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('fires each verb', () => {
    const { props } = renderBar();

    fireEvent.click(screen.getByRole('button', { name: 'Update Status' }));
    expect(props.onOpenBulkStatus).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Assign Subcontractor' }));
    expect(props.onOpenBulkAssign).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Set Testing Attributes' }));
    expect(props.onOpenBulkTestAttributes).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Print Labels' }));
    expect(props.onOpenPrintLabels).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Selected' }));
    expect(props.onOpenBulkDelete).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Clear selection/ }));
    expect(props.onClearSelection).toHaveBeenCalled();
  });

  it('greys an inapplicable verb with the reason rather than hiding it', () => {
    renderBar({ hasGoverningRuleset: false });

    const button = screen.getByTestId('bulk-test-attributes-action');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', expect.stringContaining('No frequency ruleset'));
  });

  it('offers the retry when the ruleset lookup failed', () => {
    const { props } = renderBar({ hasGoverningRuleset: false, rulesetLoadFailed: true });

    expect(screen.getByTestId('bulk-test-attributes-action')).toHaveAttribute(
      'title',
      expect.stringContaining('could not be loaded'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(props.onRetryRulesetLoad).toHaveBeenCalled();
  });

  it('omits verbs the role may not use — permission is a boundary, not a hint', () => {
    renderBar({ canDelete: false, canCreate: false, canEdit: false });

    expect(screen.queryByRole('button', { name: 'Delete Selected' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Update Status' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('bulk-test-attributes-action')).not.toBeInTheDocument();
  });

  it('hides subcontractor assignment from subcontractors', () => {
    renderBar({ isSubcontractor: true });
    expect(screen.queryByRole('button', { name: 'Assign Subcontractor' })).not.toBeInTheDocument();
  });
});

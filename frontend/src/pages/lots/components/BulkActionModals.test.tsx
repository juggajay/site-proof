import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BulkAssignModal, BulkTestAttributesModal } from './BulkActionModals';
import type { SufficiencyRuleset } from '@/lib/testSufficiency';

const ruleset: SufficiencyRuleset = {
  id: 'vicroads-204.v1',
  state: 'VIC',
  specSet: 'VicRoads',
  scaleKeys: ['A', 'B', 'C'],
  defaultScale: 'A',
  materialTypes: null,
  scaleLabel: null,
  status: 'confirmed',
  authority: 'VicRoads',
  document: 'Section 204',
  edition: 'v8.0',
  rules: [],
};

describe('BulkAssignModal', () => {
  it('collects ITP permissions when assigning selected lots to a subcontractor', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <BulkAssignModal
        isOpen
        selectedCount={2}
        subcontractors={[{ id: 'sub-1', companyName: 'Concrete Crew' }]}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.queryByLabelText('Allow ITP completion')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Subcontractor'), {
      target: { value: 'sub-1' },
    });

    fireEvent.click(screen.getByLabelText('Allow ITP completion'));
    fireEvent.click(screen.getByLabelText('Require verification (recommended)'));
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith('sub-1', {
        canCompleteITP: true,
        itpRequiresVerification: false,
      });
    });
  });

  it('returns to verification-required when completion permission is turned off', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <BulkAssignModal
        isOpen
        selectedCount={1}
        subcontractors={[{ id: 'sub-1', companyName: 'Concrete Crew' }]}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.change(screen.getByLabelText('Subcontractor'), {
      target: { value: 'sub-1' },
    });

    fireEvent.click(screen.getByLabelText('Allow ITP completion'));
    fireEvent.click(screen.getByLabelText('Require verification (recommended)'));
    fireEvent.click(screen.getByLabelText('Allow ITP completion'));
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith('sub-1', {
        canCompleteITP: false,
        itpRequiresVerification: true,
      });
    });
  });
});

// F9 (external review 2026-07-27): the modal stays mounted between openings —
// `isOpen === false` only returns null — so the previous batch's armed scale
// and quantity used to survive into the next selection, where one Confirm
// silently overwrote lots the user never intended to change.
describe('BulkTestAttributesModal', () => {
  const modalFor = (isOpen: boolean, selectedCount: number, onConfirm: () => Promise<void>) => (
    <BulkTestAttributesModal
      isOpen={isOpen}
      selectedCount={selectedCount}
      ruleset={ruleset}
      onClose={vi.fn()}
      onConfirm={onConfirm}
    />
  );

  it('starts with no armed values when reopened for a new selection', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(modalFor(true, 2, onConfirm));

    fireEvent.change(screen.getByLabelText('Testing Scale'), { target: { value: 'C' } });
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '900' } });
    fireEvent.change(screen.getByLabelText('Unit'), { target: { value: 'm2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set Attributes' }));
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith({
        testScale: 'C',
        quantityValue: 900,
        quantityUnit: 'm2',
      });
    });

    // Batch A closes; batch B opens on the SAME mounted component.
    rerender(modalFor(false, 5, onConfirm));
    rerender(modalFor(true, 5, onConfirm));

    expect((screen.getByLabelText('Testing Scale') as HTMLSelectElement).value).toBe('');
    expect((screen.getByLabelText('Quantity') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Unit') as HTMLSelectElement).value).toBe('');
    // Nothing is armed, so a stray Confirm cannot rewrite batch B.
    expect(screen.getByRole('button', { name: 'Set Attributes' })).toBeDisabled();
  });

  it('does not imply quantity drives the current check (F13)', () => {
    render(modalFor(true, 2, vi.fn().mockResolvedValue(undefined)));
    expect(screen.getByText(/quantity is recorded for rules that use it/i)).toBeInTheDocument();
  });
});

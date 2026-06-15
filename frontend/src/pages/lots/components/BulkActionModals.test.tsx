import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BulkAssignModal } from './BulkActionModals';

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

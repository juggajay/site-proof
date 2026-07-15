import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LotEditFormFields } from './LotEditFormFields';
import type { LotEditFormData, Subcontractor } from '../lotEditData';

afterEach(() => {
  cleanup();
});

const baseFormData: LotEditFormData = {
  lotNumber: 'LOT-001',
  description: 'Subgrade preparation',
  activityType: 'Earthworks',
  chainageStart: '100',
  chainageEnd: '200',
  offset: 'left',
  offsetCustom: '',
  layer: 'Subgrade',
  areaZone: 'Zone A',
  status: 'in_progress',
  budgetAmount: '48000',
  assignedSubcontractorId: '',
};

const subcontractors: Subcontractor[] = [
  { id: 'sub-1', companyName: 'Apex Civil', status: 'pending' },
  { id: 'sub-2', companyName: 'Bedrock Earthmoving', status: 'approved' },
];

function renderFields(overrides: Partial<Parameters<typeof LotEditFormFields>[0]> = {}) {
  return render(
    <LotEditFormFields
      formData={baseFormData}
      onInputChange={vi.fn()}
      detailsLocked={false}
      budgetLocked={false}
      canViewBudgets={true}
      subcontractors={[]}
      {...overrides}
    />,
  );
}

describe('LotEditFormFields', () => {
  it('hides the Commercial budget section when canViewBudgets is false', () => {
    renderFields({ canViewBudgets: false });

    expect(screen.queryByText('Commercial')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Budget Amount ($)')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Assigned Subcontractor')).not.toBeInTheDocument();
  });

  it('shows the Commercial budget section when canViewBudgets is true', () => {
    renderFields({ canViewBudgets: true });

    expect(screen.getByText('Commercial')).toBeInTheDocument();
    expect(screen.getByLabelText('Budget Amount ($)')).toHaveValue(48000);
    // The Assigned Subcontractor label always renders; with no legacy assignment
    // it shows a nudge to the modern section rather than a re-assign picker.
    expect(screen.getByText('Assigned Subcontractor')).toBeInTheDocument();
  });

  it('shows the custom offset input only when offset is custom', () => {
    const { unmount } = renderFields({ formData: { ...baseFormData, offset: 'left' } });
    expect(screen.queryByLabelText('Custom Offset Value')).not.toBeInTheDocument();
    unmount();

    renderFields({ formData: { ...baseFormData, offset: 'custom', offsetCustom: '+2.5m' } });
    expect(screen.getByLabelText('Custom Offset Value')).toHaveValue('+2.5m');
  });

  it('renders a clear-only control for an existing legacy assignment (no re-assign picker)', () => {
    renderFields({
      formData: { ...baseFormData, assignedSubcontractorId: 'sub-2' },
      subcontractors,
    });

    // Shows the current company plus a Clear option — never the other subbies,
    // because the legacy write path is retired (assigning is done in the modern
    // Subcontractor assignments section).
    expect(screen.getByRole('option', { name: 'Bedrock Earthmoving' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Clear assignment' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Apex Civil/ })).not.toBeInTheDocument();
  });

  it('shows a nudge instead of a picker when there is no legacy assignment', () => {
    renderFields({ formData: { ...baseFormData, assignedSubcontractorId: '' }, subcontractors });

    expect(screen.queryByLabelText('Assigned Subcontractor')).not.toBeInTheDocument();
    expect(
      screen.getByText(/Assign subcontractors from the Subcontractor assignments/i),
    ).toBeInTheDocument();
  });

  it('forwards field changes to onInputChange', () => {
    const onInputChange = vi.fn();
    renderFields({ onInputChange });

    fireEvent.change(screen.getByLabelText('Lot Number *'), {
      target: { value: 'LOT-002' },
    });

    expect(onInputChange).toHaveBeenCalledTimes(1);
    expect(onInputChange.mock.calls[0][0].target.name).toBe('lotNumber');
  });

  it('disables QA fields when detailsLocked but keeps budget editable when not budgetLocked', () => {
    renderFields({
      formData: { ...baseFormData, assignedSubcontractorId: 'sub-2' },
      subcontractors,
      detailsLocked: true,
      budgetLocked: false,
      canViewBudgets: true,
    });

    expect(screen.getByLabelText('Lot Number *')).toBeDisabled();
    expect(screen.getByLabelText('Status')).toBeDisabled();
    // The legacy clear-only control is still gated by detailsLocked.
    expect(screen.getByLabelText('Assigned Subcontractor')).toBeDisabled();
    expect(screen.getByLabelText('Budget Amount ($)')).toBeEnabled();
  });
});

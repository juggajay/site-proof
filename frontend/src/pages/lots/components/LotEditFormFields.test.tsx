import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LotEditFormFields } from './LotEditFormFields';
import type { LotEditFormData, Subcontractor } from '../lotEditData';
import type { SufficiencyRuleset } from '@/lib/testSufficiency';

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
  testScale: '',
  materialType: '',
  quantityValue: '',
  quantityUnit: '',
};

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
  // D14.3 §9.3: the card gates on a rule matching the lot's activity, so the
  // fixture has to carry one — `activityType: 'Earthworks'` folds to
  // `earthworks_general`.
  rules: [
    {
      id: 'vicroads-204.v1/compaction-density',
      label: 'Compaction density tests per lot',
      testType: 'compaction',
      clause: '204.13(a)',
      activitySlugs: ['earthworks_general', 'earthworks_subgrade_prep'],
    },
  ],
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

  // F13/F14 (external review 2026-07-27).
  describe('Testing section', () => {
    it('says blank scale uses the specification default, not "cannot check" (F13)', () => {
      renderFields({ ruleset });

      expect(screen.getByText(/uses the specification default \(Scale A\)/i)).toBeInTheDocument();
      // The old copy promised an unknown verdict the backend never produces.
      expect(screen.queryByText(/cannot check/i)).not.toBeInTheDocument();
      // Quantity is stored, not consumed by the live VicRoads rule.
      expect(screen.getByText(/does not change this check today/i)).toBeInTheDocument();
    });

    it('is simply absent when the project has no governing pack', () => {
      renderFields({ ruleset: null, rulesetLoadFailed: false });
      expect(screen.queryByText('Testing')).not.toBeInTheDocument();
    });

    // D14.3 §9.3 `[D14R-R10]` — the card gates on a rule matching the LOT'S
    // ACTIVITY, not merely on a pack resolving. Before this, a drainage or kerb
    // lot on an NSW project would be asked for a "Specified relative compaction"
    // band off an earthworks table that can never score it.
    describe('the activity gate', () => {
      const q6: SufficiencyRuleset = {
        ...ruleset,
        id: 'tfnsw-q6.v1',
        state: 'NSW',
        specSet: 'TfNSW',
        scaleKeys: ['<=90.0%', '>95.0-98.0%'],
        defaultScale: null,
        scaleLabel: 'Specified relative compaction',
        rules: [
          {
            id: 'tfnsw-q6.v1/compaction-density',
            label: 'Compaction samples per lot by band and area',
            testType: 'compaction',
            clause: 'Annexure Q6/L cl. L1, Table Q6/L.1',
            activitySlugs: ['earthworks_general', 'earthworks_subgrade_prep'],
          },
        ],
      };

      it("shows the card, with the PACK's word for the scale, on a matching activity", () => {
        renderFields({ ruleset: q6 });
        expect(screen.getByText('Testing')).toBeInTheDocument();
        expect(screen.getByLabelText('Specified relative compaction')).toBeInTheDocument();
        expect(screen.queryByLabelText('Testing Scale')).not.toBeInTheDocument();
      });

      it('hides the card on a lot whose activity no rule in the pack covers', () => {
        renderFields({
          ruleset: q6,
          formData: { ...baseFormData, activityType: 'kerb_channel' },
        });
        expect(screen.queryByText('Testing')).not.toBeInTheDocument();
      });

      it('KEEPS the card when the activity does not fold to a canonical slug', () => {
        // No activity to mismatch — hiding the control would hide the fix.
        renderFields({
          ruleset: q6,
          formData: { ...baseFormData, activityType: 'Pavement' },
        });
        expect(screen.getByText('Testing')).toBeInTheDocument();
      });
    });

    it('stays visible with an error and a retry when the pack lookup fails (F14)', () => {
      const onRetryRulesetLoad = vi.fn();
      renderFields({ ruleset: null, rulesetLoadFailed: true, onRetryRulesetLoad });

      expect(screen.getByText('Testing')).toBeInTheDocument();
      expect(
        screen.getByText(/could not load the test-frequency specification/i),
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      expect(onRetryRulesetLoad).toHaveBeenCalledTimes(1);
    });
  });
});

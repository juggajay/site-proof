import { describe, expect, it } from 'vitest';

import { bulkLotEffectiveTemplateId, planBulkItpTemplates } from './bulkItpPlan.js';

describe('bulkLotEffectiveTemplateId', () => {
  it('prefers the per-lot template, then the batch default, then null', () => {
    expect(bulkLotEffectiveTemplateId({ itpTemplateId: 'own' }, 'batch')).toBe('own');
    expect(bulkLotEffectiveTemplateId({ itpTemplateId: null }, 'batch')).toBe('batch');
    expect(bulkLotEffectiveTemplateId({}, 'batch')).toBe('batch');
    expect(bulkLotEffectiveTemplateId({}, null)).toBeNull();
    expect(bulkLotEffectiveTemplateId({ itpTemplateId: null }, undefined)).toBeNull();
  });
});

describe('planBulkItpTemplates', () => {
  it('maps every lot to the batch default when no per-lot templates are given', () => {
    const plan = planBulkItpTemplates(
      [{ lotNumber: 'LOT-001' }, { lotNumber: 'LOT-002' }],
      'tpl-batch',
    );
    expect(plan.distinctTemplateIds).toEqual(['tpl-batch']);
    expect([...plan.templateIdByLotNumber]).toEqual([
      ['LOT-001', 'tpl-batch'],
      ['LOT-002', 'tpl-batch'],
    ]);
  });

  it('assigns each lot its own template and dedupes the distinct set', () => {
    const plan = planBulkItpTemplates(
      [
        { lotNumber: 'LOT-001', itpTemplateId: 'tpl-earth' },
        { lotNumber: 'LOT-002', itpTemplateId: 'tpl-pave' },
        { lotNumber: 'LOT-003', itpTemplateId: 'tpl-earth' },
      ],
      null,
    );
    expect(plan.distinctTemplateIds.sort()).toEqual(['tpl-earth', 'tpl-pave']);
    expect(plan.templateIdByLotNumber.get('LOT-001')).toBe('tpl-earth');
    expect(plan.templateIdByLotNumber.get('LOT-002')).toBe('tpl-pave');
    expect(plan.templateIdByLotNumber.get('LOT-003')).toBe('tpl-earth');
  });

  it('leaves lots without any template unassigned', () => {
    const plan = planBulkItpTemplates([{ lotNumber: 'LOT-001' }], null);
    expect(plan.distinctTemplateIds).toEqual([]);
    expect(plan.templateIdByLotNumber.get('LOT-001')).toBeNull();
  });
});

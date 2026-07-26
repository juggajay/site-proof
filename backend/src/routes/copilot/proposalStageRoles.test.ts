import { describe, expect, it } from 'vitest';

import { TEMPLATE_MANAGER_ROLES } from '../itp/templateAccess.js';
import { LOT_CREATORS } from '../lots/roles.js';
import { rolesForProposalStage } from './proposalStageRoles.js';

describe('rolesForProposalStage', () => {
  it('leaves all four Wave-1 stages on LOT_CREATORS, exactly as before the map existed', () => {
    for (const stage of ['project_facts', 'control_line', 'plan_sheets', 'lot_breakdown']) {
      expect(rolesForProposalStage(stage)).toEqual([...LOT_CREATORS]);
    }
  });

  it('gates import_itp_templates on TEMPLATE_MANAGER_ROLES so a QM can sign off an ITP import', () => {
    const roles = rolesForProposalStage('import_itp_templates');
    expect(roles).toEqual([...TEMPLATE_MANAGER_ROLES]);
    expect(roles).toContain('quality_manager');
  });

  it('keeps quality_manager OUT of lot_breakdown — a QM is not a lot setup manager', () => {
    expect(rolesForProposalStage('lot_breakdown')).not.toContain('quality_manager');
  });

  it('gates import_lot_register on LOT_CREATORS', () => {
    expect(rolesForProposalStage('import_lot_register')).toEqual([...LOT_CREATORS]);
  });

  it('defaults an unknown stage to the narrower LOT_CREATORS set', () => {
    expect(rolesForProposalStage('some_future_stage')).toEqual([...LOT_CREATORS]);
  });

  it('never admits a field role to any stage', () => {
    for (const stage of ['project_facts', 'lot_breakdown', 'import_itp_templates']) {
      const roles = rolesForProposalStage(stage);
      for (const denied of ['foreman', 'viewer', 'site_engineer', 'subcontractor', 'member']) {
        expect(roles).not.toContain(denied);
      }
    }
  });

  it('returns a copy, so a caller cannot mutate the shared role list', () => {
    const roles = rolesForProposalStage('import_itp_templates');
    roles.push('foreman');
    expect(rolesForProposalStage('import_itp_templates')).not.toContain('foreman');
  });
});

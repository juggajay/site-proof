/**
 * Wave B `[WBR2-2]` — stage-aware decide/rollback permissions.
 *
 * Before Wave B both routes guarded EVERY stage with the flat `LOT_CREATORS`
 * list. That is correct for `lot_breakdown` — a quality manager is not a lot
 * setup manager, a decision already settled in this codebase — but wrong for
 * `import_itp_templates`: the quality manager is precisely the person whose job
 * is to sign off an imported ITP set, and every other template-management
 * surface already says so (`TEMPLATE_MANAGER_ROLES`).
 *
 * The default is `LOT_CREATORS`, so all four Wave-1 stages behave exactly as
 * they did before this map existed.
 */
import { TEMPLATE_MANAGER_ROLES } from '../itp/templateAccess.js';
import { LOT_CREATORS } from '../lots/roles.js';

const STAGE_DECISION_ROLES: Record<string, readonly string[]> = {
  import_itp_templates: TEMPLATE_MANAGER_ROLES,
  // B2's stage, listed so the map states the whole intended shape in one place.
  import_lot_register: LOT_CREATORS,
  model_lot_linking: LOT_CREATORS,
};

export function rolesForProposalStage(stage: string): string[] {
  return [...(STAGE_DECISION_ROLES[stage] ?? LOT_CREATORS)];
}

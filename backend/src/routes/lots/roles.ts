// =============================================================================
// Lot role constants: the role sets that gate lot create / delete / conform /
// force-conform / status-override actions. Extracted verbatim from lots.ts to
// keep authorization semantics identical (behavior-preserving) — same roles,
// same ordering.
// =============================================================================

// Roles that can create lots. Foreman is deliberately excluded: foreman is a
// field-execution role, not a lot setup/configuration role (mirrors LOT_EDITORS
// and the frontend MANAGEMENT_ROLES gate on the lot-edit route).
export const LOT_CREATORS = ['owner', 'admin', 'project_manager', 'site_manager'];
// Roles that can delete lots
export const LOT_DELETERS = ['owner', 'admin', 'project_manager'];
// Roles that can conform lots (quality management)
export const LOT_CONFORMERS = ['owner', 'admin', 'project_manager', 'quality_manager'];
export const LOT_FORCE_CONFORMERS = ['owner', 'admin'];
// Roles that can override lot status
export const STATUS_OVERRIDERS = ['owner', 'admin', 'project_manager', 'quality_manager'];

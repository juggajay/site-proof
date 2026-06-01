// =============================================================================
// Lot role constants: the role sets that gate lot create / delete / conform /
// force-conform actions. Extracted verbatim from lots.ts to keep authorization
// semantics identical (behavior-preserving) — same roles, same ordering.
// =============================================================================

// Roles that can create lots
export const LOT_CREATORS = ['owner', 'admin', 'project_manager', 'site_manager', 'foreman'];
// Roles that can delete lots
export const LOT_DELETERS = ['owner', 'admin', 'project_manager'];
// Roles that can conform lots (quality management)
export const LOT_CONFORMERS = ['owner', 'admin', 'project_manager', 'quality_manager'];
export const LOT_FORCE_CONFORMERS = ['owner', 'admin'];

export interface PortalAccess {
  lots: boolean;
  itps: boolean;
  holdPoints: boolean;
  testResults: boolean;
  ncrs: boolean;
  documents: boolean;
}

export const DEFAULT_PORTAL_ACCESS: PortalAccess = {
  lots: true,
  itps: false,
  holdPoints: false,
  testResults: false,
  ncrs: false,
  documents: false,
};

export function isPortalModuleEnabled(
  company: { portalAccess?: Partial<PortalAccess> | null } | null | undefined,
  module: keyof PortalAccess,
) {
  return (company?.portalAccess ?? DEFAULT_PORTAL_ACCESS)[module] ?? DEFAULT_PORTAL_ACCESS[module];
}

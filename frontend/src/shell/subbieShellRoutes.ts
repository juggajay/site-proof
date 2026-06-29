const CLASSIC_TO_SHELL_PATH: Record<string, string> = {
  '/subcontractor-portal': '/p',
  '/subcontractor-portal/docket/new': '/p/docket',
  '/subcontractor-portal/dockets': '/p/dockets',
  '/subcontractor-portal/work': '/p/work',
  '/subcontractor-portal/itps': '/p/itps',
  '/subcontractor-portal/holdpoints': '/p/quality',
  '/subcontractor-portal/tests': '/p/quality',
  '/subcontractor-portal/ncrs': '/p/ncrs',
  '/subcontractor-portal/documents': '/p/docs',
  '/my-company': '/p/company',
};

const SHELL_TO_CLASSIC_PATH: Record<string, string> = {
  '/p': '/subcontractor-portal',
  '/p/': '/subcontractor-portal',
  '/p/docket': '/subcontractor-portal/docket/new',
  '/p/dockets': '/subcontractor-portal/dockets',
  '/p/work': '/subcontractor-portal/work',
  '/p/itps': '/subcontractor-portal/itps',
  '/p/quality': '/subcontractor-portal/holdpoints',
  '/p/ncrs': '/subcontractor-portal/ncrs',
  '/p/docs': '/subcontractor-portal/documents',
  '/p/company': '/my-company',
};

function encodeRouteParam(value: string): string {
  return encodeURIComponent(decodeURIComponent(value));
}

export function getSubbieShellPathForClassicPath(pathname: string): string | null {
  const shellPath = CLASSIC_TO_SHELL_PATH[pathname];
  if (shellPath) return shellPath;

  const docketMatch = pathname.match(/^\/subcontractor-portal\/docket\/([^/]+)$/);
  if (docketMatch) return `/p/docket/${encodeRouteParam(docketMatch[1])}`;

  const lotItpMatch = pathname.match(/^\/subcontractor-portal\/lots\/([^/]+)\/itp$/);
  if (lotItpMatch) return `/p/lots/${encodeRouteParam(lotItpMatch[1])}/itp`;

  return null;
}

export function getClassicPortalPathForSubbieShellPath(pathname: string): string | null {
  const classicPath = SHELL_TO_CLASSIC_PATH[pathname];
  if (classicPath) return classicPath;

  const docketMatch = pathname.match(/^\/p\/docket\/([^/]+)$/);
  if (docketMatch) return `/subcontractor-portal/docket/${encodeRouteParam(docketMatch[1])}`;

  const lotItpMatch = pathname.match(/^\/p\/lots\/([^/]+)\/itp$/);
  if (lotItpMatch) {
    return `/subcontractor-portal/lots/${encodeRouteParam(lotItpMatch[1])}/itp`;
  }

  return null;
}

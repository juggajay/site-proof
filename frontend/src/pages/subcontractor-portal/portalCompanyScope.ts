export type PortalCompanyScope = {
  projectId?: string | null;
  subcontractorCompanyId?: string | null;
};

export type PortalCompanyOption = {
  id?: string | null;
  subcontractorCompanyId?: string | null;
  projectId: string;
  projectName?: string | null;
  companyName?: string | null;
};

export function getPortalCompanyScope(searchParams: URLSearchParams): PortalCompanyScope {
  return {
    projectId: searchParams.get('projectId'),
    subcontractorCompanyId: searchParams.get('subcontractorCompanyId'),
  };
}

export function getPortalCompanyId(option: PortalCompanyOption): string | null {
  return option.subcontractorCompanyId || option.id || null;
}

export function buildPortalCompanyQuery(scope: PortalCompanyScope): string {
  const query = new URLSearchParams();
  if (scope.projectId) query.set('projectId', scope.projectId);
  if (scope.subcontractorCompanyId) {
    query.set('subcontractorCompanyId', scope.subcontractorCompanyId);
  }
  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
}

export function buildPortalCompanyScopedPath(path: string, scope: PortalCompanyScope): string {
  return `${path}${buildPortalCompanyQuery(scope)}`;
}

export function portalCompanyQueryKeyParts(scope: PortalCompanyScope): readonly [string, string] {
  return [scope.projectId || 'default', scope.subcontractorCompanyId || 'default-company'] as const;
}

export function applyPortalCompanyOptionToParams(
  searchParams: URLSearchParams,
  option: PortalCompanyOption,
): URLSearchParams {
  const nextParams = new URLSearchParams(searchParams);
  nextParams.set('projectId', option.projectId);
  const companyId = getPortalCompanyId(option);
  if (companyId) {
    nextParams.set('subcontractorCompanyId', companyId);
  } else {
    nextParams.delete('subcontractorCompanyId');
  }
  return nextParams;
}

export function getPortalCompanyOptionValue(option: PortalCompanyOption): string {
  return getPortalCompanyId(option) || option.projectId;
}

export function getPortalCompanyOptionLabel(
  option: PortalCompanyOption,
  allOptions: PortalCompanyOption[],
): string {
  const projectName = option.projectName?.trim() || option.projectId;
  const companyName = option.companyName?.trim();
  const sameProjectCount = allOptions.filter(
    (candidate) => candidate.projectId === option.projectId,
  ).length;

  if (sameProjectCount > 1 && companyName) {
    return `${projectName} - ${companyName}`;
  }

  return projectName || companyName || option.projectId;
}

export function findPortalCompanyOptionByValue(
  options: PortalCompanyOption[],
  value: string,
): PortalCompanyOption | undefined {
  return options.find((option) => getPortalCompanyOptionValue(option) === value);
}

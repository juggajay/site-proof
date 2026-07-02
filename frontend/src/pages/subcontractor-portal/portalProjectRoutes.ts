export function getPortalProjectQuery(projectId: string | null | undefined): string {
  return projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
}

export function buildPortalProjectPath(path: string, projectId: string | null | undefined): string {
  return `${path}${getPortalProjectQuery(projectId)}`;
}

export function readRequestedProjectId(searchParams: URLSearchParams): string | null {
  const projectId = searchParams.get('projectId')?.trim();
  return projectId || null;
}

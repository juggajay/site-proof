function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function buildProjectSwitchPath(
  currentPathname: string,
  currentProjectId: string | undefined,
  targetProjectId: string,
): string {
  const encodedTargetProjectId = encodeURIComponent(targetProjectId);
  const defaultPath = `/projects/${encodedTargetProjectId}/lots`;

  if (!currentProjectId) return defaultPath;

  const pathParts = currentPathname.split('/').filter(Boolean);
  const projectIndex = pathParts.findIndex(
    (part, index) =>
      index > 0 &&
      pathParts[index - 1] === 'projects' &&
      decodePathSegment(part) === currentProjectId,
  );

  if (projectIndex === -1 || pathParts.length <= projectIndex + 1) {
    return defaultPath;
  }

  const moduleSegment = pathParts[projectIndex + 1];
  return `/projects/${encodedTargetProjectId}/${moduleSegment}`;
}

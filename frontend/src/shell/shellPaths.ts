export function withProjectQuery(
  path: string,
  projectId: string | null | undefined,
  params: Record<string, string | number | null | undefined> = {},
): string {
  const query = new URLSearchParams();
  if (projectId) query.set('projectId', projectId);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      query.set(key, String(value));
    }
  });

  const queryString = query.toString();
  return queryString ? `${path}?${queryString}` : path;
}

type ProjectUserDateFields = {
  joinedAt?: string | null;
  invitedAt?: string | null;
  acceptedAt?: string | null;
};

export function formatProjectUserJoinedDate(user: ProjectUserDateFields): string {
  const rawDate = user.joinedAt ?? user.acceptedAt ?? user.invitedAt;
  if (!rawDate) {
    return '—';
  }

  const date = new Date(rawDate);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-AU');
}

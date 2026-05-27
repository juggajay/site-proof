const INVITATION_EXPIRY_MS = 14 * 24 * 60 * 60 * 1000;

export function getSubcontractorInvitationExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + INVITATION_EXPIRY_MS);
}

export function isSubcontractorInvitationExpired(
  invitation: { invitationExpiresAt?: Date | null },
  now = new Date(),
): boolean {
  return Boolean(invitation.invitationExpiresAt && invitation.invitationExpiresAt <= now);
}

export function isSubcontractorInvitationAcceptableStatus(status: string): boolean {
  return status === 'pending_approval' || status === 'approved';
}

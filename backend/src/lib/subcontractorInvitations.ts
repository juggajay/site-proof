import crypto from 'crypto';

const INVITATION_EXPIRY_MS = 14 * 24 * 60 * 60 * 1000;
const INVITATION_TOKEN_PREFIX = 'sub_invite_';
const INVITATION_TOKEN_BYTES = 32;
const INVITATION_TOKEN_MAX_LENGTH = INVITATION_TOKEN_PREFIX.length + INVITATION_TOKEN_BYTES * 2;
const INVITATION_TOKEN_HASH_PREFIX = 'sha256:';

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

export function generateSubcontractorInvitationToken(): string {
  return `${INVITATION_TOKEN_PREFIX}${crypto.randomBytes(INVITATION_TOKEN_BYTES).toString('hex')}`;
}

export function hashSubcontractorInvitationToken(token: string): string {
  return `${INVITATION_TOKEN_HASH_PREFIX}${crypto.createHash('sha256').update(token).digest('hex')}`;
}

export function normalizeSubcontractorInvitationToken(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Invitation token must be a string');
  }

  const normalized = value.trim();
  if (
    !normalized.startsWith(INVITATION_TOKEN_PREFIX) ||
    normalized.length !== INVITATION_TOKEN_MAX_LENGTH
  ) {
    throw new Error('Invalid invitation token');
  }

  return normalized;
}

export function isSubcontractorInvitationToken(value: string): boolean {
  return value.startsWith(INVITATION_TOKEN_PREFIX);
}

/**
 * Mask an invited email so it can be shown to a logged-in account whose email
 * differs from the invitation. Keeps the first letter of the local part and the
 * full domain (e.g. "bob@oldco.com" -> "b***@oldco.com") so the recipient can
 * recognise the address without leaking the whole invited email to a different
 * account.
 */
export function maskInvitedEmail(email: string): string {
  const trimmed = email.trim();
  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex <= 0) {
    // No usable local part — never echo the raw value.
    return '***';
  }

  const localPart = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex);
  return `${localPart[0]}***${domain}`;
}

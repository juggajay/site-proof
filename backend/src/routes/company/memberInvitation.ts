type InvitedExistingUser =
  | {
      passwordHash: string | null;
      oauthProvider: string | null;
      companyId: string | null;
    }
  | null
  | undefined;

export function invitedMemberHasCredentials(existingUser: InvitedExistingUser): boolean {
  return Boolean(existingUser && (existingUser.passwordHash || existingUser.oauthProvider));
}

/**
 * New users and existing accounts without credentials are verified through the
 * setup link they receive on invite. Existing credentialed accounts keep their
 * own emailVerified state — an invite must not silently mark them verified.
 */
export function shouldMarkInvitedMemberVerified(existingUser: InvitedExistingUser): boolean {
  return !invitedMemberHasCredentials(existingUser);
}

/**
 * An existing credentialed account being attached to a company it is not already
 * in is a silent "absorb": it receives no setup email today. Notify it so the
 * membership change is never silent. (New/no-credential accounts already get the
 * setup invitation email, and re-roling an account already in the company is not
 * an attach.)
 */
export function shouldNotifyAttachedCompanyMember(
  existingUser: InvitedExistingUser,
  targetCompanyId: string,
): boolean {
  return invitedMemberHasCredentials(existingUser) && existingUser!.companyId !== targetCompanyId;
}

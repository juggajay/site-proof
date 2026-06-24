import { describe, expect, it } from 'vitest';

import {
  invitedMemberHasCredentials,
  shouldMarkInvitedMemberVerified,
  shouldNotifyAttachedCompanyMember,
} from './memberInvitation.js';

// Pure coverage of the invite-absorb decisions (audit finding: the invite
// endpoint silently absorbed existing credentialed accounts into a company —
// no notification, and it flipped emailVerified to true). Rule: existing
// credentialed accounts keep their own emailVerified state and must be notified
// when attached to a company they were not already in.

const credentialedPassword = { passwordHash: 'hash', oauthProvider: null, companyId: null };
const credentialedOauth = { passwordHash: null, oauthProvider: 'google', companyId: null };
const noCredentials = { passwordHash: null, oauthProvider: null, companyId: null };

describe('invitedMemberHasCredentials', () => {
  it('is false for a brand-new (null) user', () => {
    expect(invitedMemberHasCredentials(null)).toBe(false);
    expect(invitedMemberHasCredentials(undefined)).toBe(false);
  });

  it('is true when the account has a password or an oauth provider', () => {
    expect(invitedMemberHasCredentials(credentialedPassword)).toBe(true);
    expect(invitedMemberHasCredentials(credentialedOauth)).toBe(true);
  });

  it('is false for an existing account with no credentials', () => {
    expect(invitedMemberHasCredentials(noCredentials)).toBe(false);
  });
});

describe('shouldMarkInvitedMemberVerified', () => {
  it('marks new users and no-credential accounts verified (they onboard via the setup link)', () => {
    expect(shouldMarkInvitedMemberVerified(null)).toBe(true);
    expect(shouldMarkInvitedMemberVerified(noCredentials)).toBe(true);
  });

  it('does NOT flip emailVerified for existing credentialed accounts', () => {
    expect(shouldMarkInvitedMemberVerified(credentialedPassword)).toBe(false);
    expect(shouldMarkInvitedMemberVerified(credentialedOauth)).toBe(false);
  });
});

describe('shouldNotifyAttachedCompanyMember', () => {
  it('notifies a credentialed account attached to a company it was not already in', () => {
    expect(shouldNotifyAttachedCompanyMember(credentialedPassword, 'company-1')).toBe(true);
    expect(shouldNotifyAttachedCompanyMember(credentialedOauth, 'company-1')).toBe(true);
  });

  it('does not notify when the credentialed account is already in the target company (re-role)', () => {
    expect(
      shouldNotifyAttachedCompanyMember(
        { passwordHash: 'hash', oauthProvider: null, companyId: 'company-1' },
        'company-1',
      ),
    ).toBe(false);
  });

  it('does not notify new or no-credential accounts (they receive the setup email instead)', () => {
    expect(shouldNotifyAttachedCompanyMember(null, 'company-1')).toBe(false);
    expect(shouldNotifyAttachedCompanyMember(noCredentials, 'company-1')).toBe(false);
  });
});

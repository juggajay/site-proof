import { describe, expect, it } from 'vitest';

import { assertActorMayManageCompanyMemberRole } from './access.js';

// Pure coverage of the company member-management role-rank rule (audit finding:
// an admin could demote/remove peer admins and mint new admins because the only
// target guard was an owner check). Rule: the owner manages anyone; a non-owner
// admin may manage members below the admin tier but may not manage other
// admins/owners or grant the `admin` role.
describe('assertActorMayManageCompanyMemberRole', () => {
  it('lets the owner manage anyone, including admins and granting admin', () => {
    expect(() =>
      assertActorMayManageCompanyMemberRole({
        actorRole: 'owner',
        targetCurrentRole: 'admin',
        targetNewRole: 'admin',
      }),
    ).not.toThrow();
  });

  it('blocks an admin from changing another admin', () => {
    expect(() =>
      assertActorMayManageCompanyMemberRole({
        actorRole: 'admin',
        targetCurrentRole: 'admin',
        targetNewRole: 'viewer',
      }),
    ).toThrow('Only the company owner can manage other administrators');
  });

  it('blocks an admin from managing the owner', () => {
    expect(() =>
      assertActorMayManageCompanyMemberRole({
        actorRole: 'admin',
        targetCurrentRole: 'owner',
      }),
    ).toThrow('Only the company owner can manage other administrators');
  });

  it('blocks an admin from granting the admin role (minting admins)', () => {
    expect(() =>
      assertActorMayManageCompanyMemberRole({
        actorRole: 'admin',
        targetCurrentRole: 'member',
        targetNewRole: 'admin',
      }),
    ).toThrow('Only the company owner can grant the admin role');
  });

  it('allows an admin to change a non-admin member to a non-admin role', () => {
    expect(() =>
      assertActorMayManageCompanyMemberRole({
        actorRole: 'admin',
        targetCurrentRole: 'foreman',
        targetNewRole: 'viewer',
      }),
    ).not.toThrow();
  });

  it('allows an admin to remove a non-admin member (no new role supplied)', () => {
    expect(() =>
      assertActorMayManageCompanyMemberRole({
        actorRole: 'admin',
        targetCurrentRole: 'site_engineer',
      }),
    ).not.toThrow();
  });
});

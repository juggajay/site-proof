import { describe, expect, it } from 'vitest';
import {
  buildProjectUserInvitedResponse,
  buildProjectUserRemovedResponse,
  buildProjectUserRoleUpdatedResponse,
  buildProjectUsersResponse,
} from './teamResponses.js';

describe('project team response helpers', () => {
  it('builds the project users list response', () => {
    const invitedAt = new Date('2026-06-01T00:00:00.000Z');
    const acceptedAt = new Date('2026-06-02T00:00:00.000Z');

    expect(
      buildProjectUsersResponse([
        {
          id: 'membership-1',
          userId: 'user-1',
          role: 'project_manager',
          status: 'active',
          invitedAt,
          acceptedAt,
          user: {
            id: 'user-1',
            email: 'pm@example.com',
            fullName: 'Project Manager',
          },
        },
      ]),
    ).toEqual({
      users: [
        {
          id: 'membership-1',
          userId: 'user-1',
          email: 'pm@example.com',
          fullName: 'Project Manager',
          role: 'project_manager',
          status: 'active',
          invitedAt,
          acceptedAt,
        },
      ],
    });
  });

  it('builds the project user invited response', () => {
    expect(
      buildProjectUserInvitedResponse(
        { id: 'membership-1' },
        { id: 'user-1', email: 'user@example.com', fullName: 'Site User' },
        'foreman',
      ),
    ).toEqual({
      message: 'User invited successfully',
      projectUser: {
        id: 'membership-1',
        userId: 'user-1',
        email: 'user@example.com',
        fullName: 'Site User',
        role: 'foreman',
      },
    });
  });

  it('builds the project user role updated response', () => {
    expect(
      buildProjectUserRoleUpdatedResponse(
        { id: 'membership-1', role: 'quality_manager' },
        'user-1',
        'qa@example.com',
      ),
    ).toEqual({
      message: 'User role updated successfully',
      projectUser: {
        id: 'membership-1',
        userId: 'user-1',
        email: 'qa@example.com',
        role: 'quality_manager',
      },
    });
  });

  it('builds the project user removed response', () => {
    expect(
      buildProjectUserRemovedResponse(
        {
          user: {
            email: 'removed@example.com',
          },
        },
        'user-1',
      ),
    ).toEqual({
      message: 'User removed successfully',
      removedUser: {
        userId: 'user-1',
        email: 'removed@example.com',
      },
    });
  });
});

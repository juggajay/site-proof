import { describe, expect, it } from 'vitest';

import {
  buildAuditActionsResponse,
  buildAuditEntityTypesResponse,
  buildAuditLogListResponse,
  buildAuditUsersResponse,
} from './responses.js';

describe('audit log response helpers', () => {
  it('preserves the list response envelope and minimum one-page pagination', () => {
    const logs = [{ id: 'audit-1', action: 'project_created' }];

    expect(buildAuditLogListResponse(logs, 0, 2, 50)).toEqual({
      logs,
      pagination: {
        page: 2,
        limit: 50,
        total: 0,
        totalPages: 1,
      },
    });
  });

  it('preserves calculated pagination page counts', () => {
    expect(buildAuditLogListResponse([], 101, 3, 50).pagination).toEqual({
      page: 3,
      limit: 50,
      total: 101,
      totalPages: 3,
    });
  });

  it('preserves action and entity-type filter envelopes', () => {
    expect(buildAuditActionsResponse(['lot_created', 'project_created'])).toEqual({
      actions: ['lot_created', 'project_created'],
    });
    expect(buildAuditEntityTypesResponse(['lot', 'project'])).toEqual({
      entityTypes: ['lot', 'project'],
    });
  });

  it('preserves the users filter envelope', () => {
    const users = [
      { id: 'user-1', email: 'owner@example.com', fullName: 'Owner One' },
      { id: 'user-2', email: 'admin@example.com', fullName: null },
    ];

    expect(buildAuditUsersResponse(users)).toEqual({ users });
  });
});

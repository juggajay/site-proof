import { describe, expect, it } from 'vitest';
import { buildProjectAuditLogsResponse } from './auditResponses.js';

describe('project audit response helper', () => {
  it('maps audit log rows into the project audit response shape', () => {
    const createdAt = new Date('2026-06-01T00:00:00.000Z');

    expect(
      buildProjectAuditLogsResponse([
        {
          id: 'audit-1',
          action: 'project_created',
          entityType: 'project',
          entityId: 'project-1',
          changes: JSON.stringify({ name: 'Gateway Upgrade' }),
          ipAddress: '127.0.0.1',
          createdAt,
          user: {
            email: 'owner@example.com',
            fullName: 'Owner User',
          },
        },
      ]),
    ).toEqual({
      auditLogs: [
        {
          id: 'audit-1',
          action: 'project_created',
          entityType: 'project',
          entityId: 'project-1',
          changes: { name: 'Gateway Upgrade' },
          performedBy: {
            email: 'owner@example.com',
            fullName: 'Owner User',
          },
          ipAddress: '127.0.0.1',
          createdAt,
        },
      ],
    });
  });

  it('preserves null performer values', () => {
    const createdAt = new Date('2026-06-01T00:00:00.000Z');

    expect(
      buildProjectAuditLogsResponse([
        {
          id: 'audit-1',
          action: 'system_event',
          entityType: 'project',
          entityId: 'project-1',
          changes: null,
          ipAddress: null,
          createdAt,
          user: null,
        },
      ]).auditLogs[0],
    ).toEqual({
      id: 'audit-1',
      action: 'system_event',
      entityType: 'project',
      entityId: 'project-1',
      changes: null,
      performedBy: null,
      ipAddress: null,
      createdAt,
    });
  });
});

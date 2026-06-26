import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  triggerWebhooks: vi.fn(),
  projectFindUnique: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('../webhooks/delivery.js', () => ({ triggerWebhooks: mocks.triggerWebhooks }));
vi.mock('../../lib/prisma.js', () => ({
  prisma: { project: { findUnique: mocks.projectFindUnique } },
}));
vi.mock('../../lib/serverLogger.js', () => ({ logError: mocks.logError }));

import { emitNcrWebhookEvent } from './webhookEvents.js';

beforeEach(() => {
  mocks.triggerWebhooks.mockReset();
  mocks.triggerWebhooks.mockResolvedValue(undefined);
  mocks.projectFindUnique.mockReset();
  mocks.projectFindUnique.mockResolvedValue({ companyId: 'company-1' });
  mocks.logError.mockReset();
});

describe('emitNcrWebhookEvent (GAP-A)', () => {
  it('fires the event to the project company via triggerWebhooks', async () => {
    emitNcrWebhookEvent('project-1', 'ncr.created', {
      ncrId: 'ncr-1',
      projectId: 'project-1',
      ncrNumber: 'NCR-001',
      status: 'open',
      severity: 'minor',
      actorUserId: 'user-1',
      action: 'created',
    });

    await vi.waitFor(() => {
      expect(mocks.triggerWebhooks).toHaveBeenCalledWith(
        'company-1',
        'ncr.created',
        expect.objectContaining({ ncrId: 'ncr-1', ncrNumber: 'NCR-001' }),
      );
    });
  });

  it('does not fire when the project has no company', async () => {
    mocks.projectFindUnique.mockResolvedValue(null);

    emitNcrWebhookEvent('project-1', 'ncr.closed', {
      ncrId: 'ncr-2',
      projectId: 'project-1',
      ncrNumber: 'NCR-002',
      status: 'closed',
      severity: 'major',
      actorUserId: 'user-1',
      action: 'closed',
    });

    // Give the fire-and-forget microtask a chance to run, then assert no call.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mocks.triggerWebhooks).not.toHaveBeenCalled();
  });
});

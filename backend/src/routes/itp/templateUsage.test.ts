import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Characterizes the ITP template usage guard used by PATCH /api/itp/templates/:id
 * before it replaces a template's checklist items.
 *
 * Replacing checklist items deletes and re-creates them, but sign-off records reference
 * those items with onDelete: Restrict (completions, hold points), so any sign-off would
 * abort the delete with an opaque 500. The DB queries are kept DB-free by mocking the
 * Prisma client module. These tests freeze:
 *  - counting completions + hold points + test results tied to the template's items,
 *  - distinct-lot counting across all three sources (deduped, nulls ignored),
 *  - the plain-English in-use message and its singular/plural lot wording,
 *  - the 409 TEMPLATE_IN_USE thrown when any reference exists, and
 *  - the no-throw path when the template is unused.
 */

const mocks = vi.hoisted(() => ({
  completionFindMany: vi.fn(),
  holdPointFindMany: vi.fn(),
  testResultFindMany: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    iTPCompletion: { findMany: mocks.completionFindMany },
    holdPoint: { findMany: mocks.holdPointFindMany },
    testResult: { findMany: mocks.testResultFindMany },
  },
}));

import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import {
  assertTemplateItemsReplaceable,
  buildTemplateInUseMessage,
  countTemplateItemUsage,
  type TemplateUsageClient,
} from './templateUsage.js';

const TEMPLATE_ID = 'template-1';
const client = prisma as unknown as TemplateUsageClient;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.completionFindMany.mockResolvedValue([]);
  mocks.holdPointFindMany.mockResolvedValue([]);
  mocks.testResultFindMany.mockResolvedValue([]);
});

describe('countTemplateItemUsage', () => {
  it('reports zero usage for an unused template', async () => {
    const usage = await countTemplateItemUsage(client, TEMPLATE_ID);

    expect(usage).toEqual({ referenceCount: 0, lotCount: 0 });
  });

  it('queries each source scoped to the template id', async () => {
    await countTemplateItemUsage(client, TEMPLATE_ID);

    expect(mocks.completionFindMany).toHaveBeenCalledWith({
      where: { checklistItem: { templateId: TEMPLATE_ID } },
      select: { itpInstance: { select: { lotId: true } } },
    });
    expect(mocks.holdPointFindMany).toHaveBeenCalledWith({
      where: { itpChecklistItem: { templateId: TEMPLATE_ID } },
      select: { lotId: true },
    });
    expect(mocks.testResultFindMany).toHaveBeenCalledWith({
      where: { itpChecklistItem: { templateId: TEMPLATE_ID } },
      select: { lotId: true },
    });
  });

  it('sums references across completions, hold points, and test results', async () => {
    mocks.completionFindMany.mockResolvedValue([
      { itpInstance: { lotId: 'lot-a' } },
      { itpInstance: { lotId: 'lot-a' } },
    ]);
    mocks.holdPointFindMany.mockResolvedValue([{ lotId: 'lot-b' }]);
    mocks.testResultFindMany.mockResolvedValue([{ lotId: 'lot-c' }]);

    const usage = await countTemplateItemUsage(client, TEMPLATE_ID);

    expect(usage.referenceCount).toBe(4);
  });

  it('counts distinct lots across all three sources and ignores nulls', async () => {
    mocks.completionFindMany.mockResolvedValue([
      { itpInstance: { lotId: 'lot-a' } },
      { itpInstance: { lotId: 'lot-b' } },
      { itpInstance: null }, // orphaned instance reference
    ]);
    mocks.holdPointFindMany.mockResolvedValue([
      { lotId: 'lot-b' }, // already counted via a completion
      { lotId: null },
    ]);
    mocks.testResultFindMany.mockResolvedValue([
      { lotId: 'lot-c' },
      { lotId: null }, // test result with its lot detached
    ]);

    const usage = await countTemplateItemUsage(client, TEMPLATE_ID);

    expect(usage.lotCount).toBe(3); // lot-a, lot-b, lot-c
    // 3 completions + 2 hold points + 2 test results
    expect(usage.referenceCount).toBe(7);
  });
});

describe('buildTemplateInUseMessage', () => {
  it('uses singular wording for one lot', () => {
    expect(buildTemplateInUseMessage(1)).toBe(
      "This template is in use by 1 lot with recorded sign-offs, so its checklist items can't be changed. Duplicate the template and edit the copy.",
    );
  });

  it('uses plural wording for multiple lots', () => {
    expect(buildTemplateInUseMessage(3)).toBe(
      "This template is in use by 3 lots with recorded sign-offs, so its checklist items can't be changed. Duplicate the template and edit the copy.",
    );
  });
});

describe('assertTemplateItemsReplaceable', () => {
  it('does not throw when the template is unused', async () => {
    await expect(assertTemplateItemsReplaceable(client, TEMPLATE_ID)).resolves.toBeUndefined();
  });

  it('throws a 409 TEMPLATE_IN_USE when any sign-off references the items', async () => {
    mocks.completionFindMany.mockResolvedValue([{ itpInstance: { lotId: 'lot-a' } }]);
    mocks.holdPointFindMany.mockResolvedValue([{ lotId: 'lot-b' }]);

    let thrown: unknown;
    try {
      await assertTemplateItemsReplaceable(client, TEMPLATE_ID);
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(AppError);
    const error = thrown as AppError;
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('TEMPLATE_IN_USE');
    expect(error.message).toBe(
      "This template is in use by 2 lots with recorded sign-offs, so its checklist items can't be changed. Duplicate the template and edit the copy.",
    );
    expect(error.details).toMatchObject({
      code: 'TEMPLATE_IN_USE',
      lotCount: 2,
      referenceCount: 2,
    });
  });

  it('throws even when a hold point is the only reference', async () => {
    mocks.holdPointFindMany.mockResolvedValue([{ lotId: 'lot-z' }]);

    await expect(assertTemplateItemsReplaceable(client, TEMPLATE_ID)).rejects.toMatchObject({
      statusCode: 409,
      code: 'TEMPLATE_IN_USE',
    });
  });
});

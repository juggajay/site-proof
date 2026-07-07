import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../../../lib/AppError.js';
import {
  ITP_INSTANCE_HAS_RECORDED_WORK_CODE,
  assertItpInstanceUnassignable,
  countItpInstanceRecordedWork,
  type ItpInstanceUnassignGuardClient,
} from './unassignGuard.js';

const mocks = vi.hoisted(() => ({
  completionCount: vi.fn(),
  holdPointCount: vi.fn(),
  testResultCount: vi.fn(),
}));

const client = {
  iTPCompletion: { count: mocks.completionCount },
  holdPoint: { count: mocks.holdPointCount },
  testResult: { count: mocks.testResultCount },
} as unknown as ItpInstanceUnassignGuardClient;

const scope = {
  instanceId: 'itp-instance-1',
  lotId: 'lot-1',
  templateId: 'template-1',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.completionCount.mockResolvedValue(0);
  mocks.holdPointCount.mockResolvedValue(0);
  mocks.testResultCount.mockResolvedValue(0);
});

describe('countItpInstanceRecordedWork', () => {
  it('reports zero recorded work when all sources are empty', async () => {
    const counts = await countItpInstanceRecordedWork(client, scope);

    expect(counts).toEqual({
      completionCount: 0,
      holdPointCount: 0,
      testResultCount: 0,
    });
  });

  it('queries each recorded-work source scoped to the instance lot and template', async () => {
    await countItpInstanceRecordedWork(client, scope);

    expect(mocks.completionCount).toHaveBeenCalledWith({
      where: { itpInstanceId: scope.instanceId },
    });
    expect(mocks.holdPointCount).toHaveBeenCalledWith({
      where: {
        lotId: scope.lotId,
        itpChecklistItem: { templateId: scope.templateId },
      },
    });
    expect(mocks.testResultCount).toHaveBeenCalledWith({
      where: {
        lotId: scope.lotId,
        itpChecklistItem: { templateId: scope.templateId },
      },
    });
  });

  it('returns the independent completion, hold point, and test result counts', async () => {
    mocks.completionCount.mockResolvedValue(2);
    mocks.holdPointCount.mockResolvedValue(3);
    mocks.testResultCount.mockResolvedValue(4);

    const counts = await countItpInstanceRecordedWork(client, scope);

    expect(counts).toEqual({
      completionCount: 2,
      holdPointCount: 3,
      testResultCount: 4,
    });
  });
});

describe('assertItpInstanceUnassignable', () => {
  it('does not throw when the ITP instance has no recorded work', async () => {
    await expect(assertItpInstanceUnassignable(client, scope)).resolves.toBeUndefined();
  });

  it.each([
    ['completion', { completionCount: 1, holdPointCount: 0, testResultCount: 0 }],
    ['hold point', { completionCount: 0, holdPointCount: 1, testResultCount: 0 }],
    ['test result', { completionCount: 0, holdPointCount: 0, testResultCount: 1 }],
  ])('throws a structured 409 when a %s exists', async (_source, counts) => {
    mocks.completionCount.mockResolvedValue(counts.completionCount);
    mocks.holdPointCount.mockResolvedValue(counts.holdPointCount);
    mocks.testResultCount.mockResolvedValue(counts.testResultCount);

    let thrown: unknown;
    try {
      await assertItpInstanceUnassignable(client, scope);
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(AppError);
    const error = thrown as AppError;
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('CONFLICT');
    expect(error.message).toBe(
      "This ITP has recorded work on this lot and can't be unassigned. Remove the recorded completions, hold points, or test results before unassigning it.",
    );
    expect(error.details).toEqual({
      code: ITP_INSTANCE_HAS_RECORDED_WORK_CODE,
      completionCount: counts.completionCount,
      holdPointCount: counts.holdPointCount,
      testResultCount: counts.testResultCount,
    });
  });
});

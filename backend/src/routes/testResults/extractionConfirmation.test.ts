import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../lib/AppError.js';
import { buildConfirmationUpdateData, processBatchConfirm } from './extractionConfirmation.js';

function expectBadRequest(fn: () => unknown) {
  let captured: unknown;
  try {
    fn();
  } catch (error) {
    captured = error;
  }
  expect(captured).toBeInstanceOf(AppError);
  expect((captured as AppError).statusCode).toBe(400);
}

const NOW = new Date('2026-05-31T00:00:00.000Z');

describe('buildConfirmationUpdateData', () => {
  it('stamps status/enteredBy/enteredAt with no corrections payload', () => {
    expect(buildConfirmationUpdateData(undefined, 'user-1', NOW)).toEqual({
      status: 'entered',
      enteredById: 'user-1',
      enteredAt: NOW,
    });
  });

  it('stamps status/enteredBy/enteredAt for an empty corrections object', () => {
    expect(buildConfirmationUpdateData({}, 'user-1', NOW)).toEqual({
      status: 'entered',
      enteredById: 'user-1',
      enteredAt: NOW,
    });
  });

  it('applies valid corrections alongside the entered stamps', () => {
    expect(
      buildConfirmationUpdateData(
        { resultValue: '98.5', passFail: 'pass', testType: 'CBR Test' },
        'user-1',
        NOW,
      ),
    ).toEqual({
      testType: 'CBR Test',
      resultValue: 98.5,
      passFail: 'pass',
      status: 'entered',
      enteredById: 'user-1',
      enteredAt: NOW,
    });
  });

  it('defaults enteredAt to the current time when no clock is supplied', () => {
    const result = buildConfirmationUpdateData(undefined, 'user-1');
    expect(result.enteredAt).toBeInstanceOf(Date);
    expect(result.status).toBe('entered');
    expect(result.enteredById).toBe('user-1');
  });

  it('propagates a 400 for an invalid numeric correction', () => {
    expectBadRequest(() => buildConfirmationUpdateData({ resultValue: '95abc' }, 'user-1'));
  });

  it('propagates a 400 for an invalid date correction', () => {
    expectBadRequest(() => buildConfirmationUpdateData({ sampleDate: '2026-02-31' }, 'user-1'));
  });

  it('propagates a 400 for an invalid passFail correction', () => {
    expectBadRequest(() => buildConfirmationUpdateData({ passFail: 'maybe' }, 'user-1'));
  });
});

describe('processBatchConfirm', () => {
  it('rejects a missing, empty, or non-array confirmations payload', async () => {
    const authorize = vi.fn(async () => true);

    for (const confirmations of [undefined, null, [], 'nope', {}]) {
      await expect(
        processBatchConfirm({ confirmations, userId: 'user-1', authorize }),
      ).rejects.toThrow('confirmations array is required');
    }
    expect(authorize).not.toHaveBeenCalled();
  });

  it('records invalid test result ids as failures without touching the DB or authorize', async () => {
    const authorize = vi.fn(async () => true);

    const result = await processBatchConfirm({
      confirmations: [{}, { testResultId: 42 }, { testResultId: '' }],
      userId: 'user-1',
      authorize,
    });

    expect(authorize).not.toHaveBeenCalled();
    expect(result.message).toBe('Confirmed 0 of 3 test results');
    expect(result.summary).toEqual({ total: 3, success: 0, failed: 3 });
    expect(result.results).toEqual([
      { success: false, testResultId: '', error: 'Invalid test result id' },
      { success: false, testResultId: '', error: 'Invalid test result id' },
      { success: false, testResultId: '', error: 'Invalid test result id' },
    ]);
  });
});

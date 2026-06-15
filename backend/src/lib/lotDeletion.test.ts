import { describe, expect, it } from 'vitest';
import { assertLotDeletable, assertLotsBulkDeletable } from './lotDeletion.js';

describe('lot deletion guard', () => {
  it('rejects deleting a single lot with released hold-point evidence', () => {
    expect(() =>
      assertLotDeletable({
        status: 'in_progress',
        holdPoints: [{ id: 'hp-released-1', status: 'released' }],
      }),
    ).toThrowError(/released hold point/);

    try {
      assertLotDeletable({
        status: 'in_progress',
        holdPoints: [{ id: 'hp-released-1', status: 'released' }],
      });
    } catch (error) {
      expect(error).toMatchObject({
        statusCode: 400,
        details: { code: 'RELEASED_HOLD_POINTS', releasedHoldPoints: 1 },
      });
    }
  });

  it('rejects bulk deletion when any selected lot has released hold-point evidence', () => {
    expect(() =>
      assertLotsBulkDeletable([
        {
          lotNumber: 'LOT-HP-1',
          status: 'in_progress',
          holdPoints: [{ id: 'hp-released-1', status: 'released' }],
        },
      ]),
    ).toThrowError(/released hold points/);

    try {
      assertLotsBulkDeletable([
        {
          lotNumber: 'LOT-HP-1',
          status: 'in_progress',
          holdPoints: [{ id: 'hp-released-1', status: 'released' }],
        },
      ]);
    } catch (error) {
      expect(error).toMatchObject({
        statusCode: 400,
        details: { code: 'RELEASED_HOLD_POINTS' },
      });
    }
  });
});

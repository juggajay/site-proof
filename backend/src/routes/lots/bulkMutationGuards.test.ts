import { describe, expect, it } from 'vitest';
import { assertLotsBulkMutable } from './bulkMutationGuards.js';
import { AppError } from '../../lib/AppError.js';

const lot = (lotNumber: string, status: string) => ({ lotNumber, status });

describe('assertLotsBulkMutable (pure)', () => {
  it('passes when all lots have mutable statuses', () => {
    expect(() =>
      assertLotsBulkMutable([lot('LOT-001', 'open'), lot('LOT-002', 'in_progress')]),
    ).not.toThrow();
  });

  it('throws the exact bad-request for a conformed lot (VALIDATION_ERROR contract)', () => {
    let caught: unknown;
    try {
      assertLotsBulkMutable([lot('LOT-001', 'open'), lot('LOT-002', 'conformed')]);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).message).toBe(
      'Cannot update 1 lot(s) that are conformed or claimed: LOT-002',
    );
    expect((caught as AppError).statusCode).toBe(400);
    expect((caught as AppError).code).toBe('VALIDATION_ERROR');
  });

  it('throws the exact bad-request for a claimed lot', () => {
    expect(() => assertLotsBulkMutable([lot('LOT-003', 'claimed')])).toThrow(
      'Cannot update 1 lot(s) that are conformed or claimed: LOT-003',
    );
  });

  it('mixed conformed/claimed: count and lot numbers preserve input array order', () => {
    let caught: unknown;
    try {
      assertLotsBulkMutable([
        lot('LOT-005', 'claimed'),
        lot('LOT-001', 'open'),
        lot('LOT-009', 'conformed'),
        lot('LOT-003', 'claimed'),
      ]);
    } catch (err) {
      caught = err;
    }
    expect((caught as AppError).message).toBe(
      'Cannot update 3 lot(s) that are conformed or claimed: LOT-005, LOT-009, LOT-003',
    );
  });

  it('uses exact lowercase status comparison (Conformed / CLAIMED do not match)', () => {
    expect(() =>
      assertLotsBulkMutable([lot('LOT-001', 'Conformed'), lot('LOT-002', 'CLAIMED')]),
    ).not.toThrow();
  });
});

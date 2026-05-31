import { describe, expect, it } from 'vitest';
import type { Prisma } from '@prisma/client';
import { AppError } from '../../lib/AppError.js';
import { applyTestResultCorrections } from './corrections.js';

const emptyUpdate = (): Prisma.TestResultUncheckedUpdateInput => ({});

/**
 * Characterizes the pure correction-mapping behaviour that the confirm-extraction
 * and batch-confirm flows depend on. The mapper mutates the Prisma update object
 * in place, only touching keys explicitly present on `corrections`, and throws the
 * same AppError.badRequest validation errors the route threw inline.
 */
describe('applyTestResultCorrections', () => {
  describe('guard clauses', () => {
    it('leaves the update object untouched when corrections is undefined', () => {
      const updateData = emptyUpdate();
      applyTestResultCorrections(updateData, undefined);
      expect(updateData).toEqual({});
    });

    it('leaves the update object untouched when corrections is an empty object', () => {
      const updateData = emptyUpdate();
      applyTestResultCorrections(updateData, {});
      expect(updateData).toEqual({});
    });

    it('only maps keys present on corrections (does not invent fields)', () => {
      const updateData = emptyUpdate();
      applyTestResultCorrections(updateData, { testType: 'CBR Test' });
      expect(updateData).toEqual({ testType: 'CBR Test' });
    });
  });

  describe('valid corrections', () => {
    it('maps a full set of valid corrections onto the Prisma update object', () => {
      const updateData = emptyUpdate();
      applyTestResultCorrections(updateData, {
        testType: 'Compaction Test',
        testRequestNumber: 'TRN-001',
        laboratoryName: 'ACME Labs',
        laboratoryReportNumber: 'LR-9',
        sampleDate: '2026-05-15',
        sampleLocation: 'CH 1200 RHS',
        testDate: '2026-05-16',
        resultDate: '2026-05-17',
        resultValue: '98.5',
        resultUnit: '% MDD',
        specificationMin: '95',
        specificationMax: '100',
        passFail: 'pass',
      });

      expect(updateData).toEqual({
        testType: 'Compaction Test',
        testRequestNumber: 'TRN-001',
        laboratoryName: 'ACME Labs',
        laboratoryReportNumber: 'LR-9',
        sampleDate: new Date(Date.UTC(2026, 4, 15)),
        sampleLocation: 'CH 1200 RHS',
        testDate: new Date(Date.UTC(2026, 4, 16)),
        resultDate: new Date(Date.UTC(2026, 4, 17)),
        resultValue: 98.5,
        resultUnit: '% MDD',
        specificationMin: 95,
        specificationMax: 100,
        passFail: 'pass',
      });
    });

    it('accepts valid numeric strings and stores them as numbers', () => {
      const updateData = emptyUpdate();
      applyTestResultCorrections(updateData, {
        resultValue: '12.75',
        specificationMin: '0',
        specificationMax: '50',
      });
      expect(updateData.resultValue).toBe(12.75);
      expect(updateData.specificationMin).toBe(0);
      expect(updateData.specificationMax).toBe(50);
    });

    it('maps a valid sample date to a UTC-midnight Date', () => {
      const updateData = emptyUpdate();
      applyTestResultCorrections(updateData, { sampleDate: '2026-05-15' });
      expect(updateData.sampleDate).toBeInstanceOf(Date);
      expect((updateData.sampleDate as Date).toISOString()).toBe('2026-05-15T00:00:00.000Z');
    });

    it('lower-cases a valid passFail value', () => {
      const updateData = emptyUpdate();
      applyTestResultCorrections(updateData, { passFail: 'PASS' });
      expect(updateData.passFail).toBe('pass');
    });

    it('defaults a blank passFail to "pending"', () => {
      const updateData = emptyUpdate();
      applyTestResultCorrections(updateData, { passFail: '   ' });
      expect(updateData.passFail).toBe('pending');
    });

    it('clears a nullable string field when given null', () => {
      const updateData = emptyUpdate();
      applyTestResultCorrections(updateData, { laboratoryName: null });
      expect(updateData).toEqual({ laboratoryName: null });
    });
  });

  describe('invalid corrections throw the same validation errors', () => {
    const expectBadRequest = (run: () => void, message: string) => {
      let caught: unknown;
      try {
        run();
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(AppError);
      expect((caught as AppError).statusCode).toBe(400);
      expect((caught as AppError).code).toBe('VALIDATION_ERROR');
      expect((caught as AppError).message).toBe(message);
    };

    it('throws when resultValue is not a valid number', () => {
      expectBadRequest(
        () => applyTestResultCorrections(emptyUpdate(), { resultValue: 'not-a-number' }),
        'resultValue must be a valid number',
      );
    });

    it('throws when specificationMin is not a valid number', () => {
      expectBadRequest(
        () => applyTestResultCorrections(emptyUpdate(), { specificationMin: 'low' }),
        'specificationMin must be a valid number',
      );
    });

    it('throws when sampleDate is not in YYYY-MM-DD format', () => {
      expectBadRequest(
        () => applyTestResultCorrections(emptyUpdate(), { sampleDate: '15/05/2026' }),
        'sampleDate must be a date in YYYY-MM-DD format',
      );
    });

    it('throws when sampleDate is a non-existent calendar date', () => {
      expectBadRequest(
        () => applyTestResultCorrections(emptyUpdate(), { sampleDate: '2026-02-31' }),
        'sampleDate must be a valid date',
      );
    });

    it('throws when passFail is not an allowed value', () => {
      expectBadRequest(
        () => applyTestResultCorrections(emptyUpdate(), { passFail: 'maybe' }),
        'passFail must be pass, fail, or pending',
      );
    });

    it('throws when the required testType is blank', () => {
      expectBadRequest(
        () => applyTestResultCorrections(emptyUpdate(), { testType: '   ' }),
        'testType is required',
      );
    });

    it('throws when a string field receives a non-string value', () => {
      expectBadRequest(
        () => applyTestResultCorrections(emptyUpdate(), { laboratoryName: 123 }),
        'laboratoryName must be a string',
      );
    });
  });
});

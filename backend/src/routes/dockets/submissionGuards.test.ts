import { describe, expect, it } from 'vitest';
import { AppError } from '../../lib/AppError.js';
import { assertDocketSubmittable, type DocketSubmissionSource } from './submissionGuards.js';

// Pure precondition guard — characterized with plain object fixtures, no DB.
const rows = (n: number): unknown[] => Array.from({ length: n }, (_, i) => ({ i }));

const labourEntry = (allocations: number): DocketSubmissionSource['labourEntries'][number] => ({
  lotAllocations: rows(allocations),
});

const makeDocket = (overrides: Partial<DocketSubmissionSource> = {}): DocketSubmissionSource => ({
  status: 'draft',
  labourEntries: [],
  plantEntries: [],
  ...overrides,
});

// Captures the thrown AppError so individual properties (statusCode/code/message)
// can be asserted — the wire contract differs per failure case.
function captureError(fn: () => void): AppError {
  try {
    fn();
  } catch (err) {
    return err as AppError;
  }
  throw new Error('Expected assertDocketSubmittable to throw, but it did not');
}

describe('assertDocketSubmittable (pure, DB-free)', () => {
  it('passes for a draft docket with a plant-only entry (no labour, lot check skipped)', () => {
    const docket = makeDocket({ status: 'draft', labourEntries: [], plantEntries: rows(1) });
    expect(() => assertDocketSubmittable(docket)).not.toThrow();
  });

  it('passes for a rejected docket with a labour entry that has a lot allocation', () => {
    const docket = makeDocket({ status: 'rejected', labourEntries: [labourEntry(1)] });
    expect(() => assertDocketSubmittable(docket)).not.toThrow();
  });

  it('can reuse the entry and lot checks for queried docket responses', () => {
    const docket = makeDocket({ status: 'queried', labourEntries: [labourEntry(1)] });
    expect(() =>
      assertDocketSubmittable(docket, {
        allowedStatuses: ['queried'],
        invalidStatusMessage: 'Only queried dockets can be responded to',
      }),
    ).not.toThrow();
  });

  it('uses the caller message when a reused guard rejects the status', () => {
    const docket = makeDocket({
      status: 'pending_approval',
      labourEntries: [labourEntry(1)],
    });
    const err = captureError(() =>
      assertDocketSubmittable(docket, {
        allowedStatuses: ['queried'],
        invalidStatusMessage: 'Only queried dockets can be responded to',
      }),
    );
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('Only queried dockets can be responded to');
  });

  it('throws LOT_REQUIRED when any labour entry has no lot allocation', () => {
    const docket = makeDocket({
      status: 'draft',
      labourEntries: [labourEntry(0), labourEntry(1), labourEntry(0)],
    });
    const err = captureError(() => assertDocketSubmittable(docket));
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('LOT_REQUIRED');
    expect(err.message).toBe(
      'Every labour entry must be allocated to a lot before submitting the docket.',
    );
  });

  it('throws a VALIDATION_ERROR bad-request for a non-draft/non-rejected status', () => {
    for (const status of ['pending_approval', 'approved']) {
      const docket = makeDocket({
        status,
        labourEntries: [labourEntry(1)],
        plantEntries: rows(1),
      });
      const err = captureError(() => assertDocketSubmittable(docket));
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.message).toBe('Only draft or rejected dockets can be submitted');
    }
  });

  it('throws ENTRY_REQUIRED when there are no labour and no plant entries', () => {
    const docket = makeDocket({ status: 'draft', labourEntries: [], plantEntries: [] });
    const err = captureError(() => assertDocketSubmittable(docket));
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('ENTRY_REQUIRED');
    expect(err.message).toBe(
      'At least one labour or plant entry is required before submitting the docket.',
    );
  });

  it('throws LOT_REQUIRED when labour entries exist but none has a lot allocation', () => {
    const docket = makeDocket({ status: 'draft', labourEntries: [labourEntry(0)] });
    const err = captureError(() => assertDocketSubmittable(docket));
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('LOT_REQUIRED');
    expect(err.message).toBe(
      'Every labour entry must be allocated to a lot before submitting the docket.',
    );
  });

  it('treats a null lotAllocations as no allocation (LOT_REQUIRED)', () => {
    const docket = makeDocket({ status: 'draft', labourEntries: [{ lotAllocations: null }] });
    const err = captureError(() => assertDocketSubmittable(docket));
    expect(err.code).toBe('LOT_REQUIRED');
  });
});

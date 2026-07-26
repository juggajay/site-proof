import { describe, expect, it } from 'vitest';

import { AppError } from '../../../lib/AppError.js';
import {
  assertBatchTransition,
  IMPORT_BATCH_STATUSES,
  isTerminalImportBatchStatus,
  type ImportBatchStatus,
} from './batchState.js';

describe('ImportBatch state machine', () => {
  it('walks the happy path', () => {
    const path: ImportBatchStatus[] = [
      'uploaded',
      'parsed',
      'mapped',
      'dry_run',
      'review',
      'applied',
      'rolled_back',
    ];
    for (let i = 0; i < path.length - 1; i += 1) {
      expect(() => assertBatchTransition(path[i], path[i + 1])).not.toThrow();
    }
  });

  it('allows the re-map loop dry_run -> mapped -> dry_run', () => {
    expect(() => assertBatchTransition('dry_run', 'mapped')).not.toThrow();
    expect(() => assertBatchTransition('mapped', 'dry_run')).not.toThrow();
  });

  it('rejects skipping straight from parsed to applied', () => {
    expect(() => assertBatchTransition('parsed', 'applied')).toThrow(AppError);
  });

  it('rejects going backwards from applied', () => {
    expect(() => assertBatchTransition('applied', 'review')).toThrow(/cannot go from applied/);
    expect(() => assertBatchTransition('applied', 'cancelled')).toThrow(AppError);
  });

  it('lets nothing out of a terminal state', () => {
    for (const terminal of ['rolled_back', 'cancelled', 'failed'] as ImportBatchStatus[]) {
      expect(isTerminalImportBatchStatus(terminal)).toBe(true);
      for (const target of IMPORT_BATCH_STATUSES) {
        expect(() => assertBatchTransition(terminal, target)).toThrow(AppError);
      }
    }
  });

  it('allows cancel and fail from every non-terminal state', () => {
    for (const status of [
      'uploaded',
      'parsed',
      'mapped',
      'dry_run',
      'review',
    ] as ImportBatchStatus[]) {
      expect(() => assertBatchTransition(status, 'cancelled')).not.toThrow();
      expect(() =>
        assertBatchTransition(status, 'failed', 'the file was unreadable'),
      ).not.toThrow();
    }
  });

  it('refuses `failed` without a reason', () => {
    expect(() => assertBatchTransition('parsed', 'failed')).toThrow(/must record why it failed/);
    expect(() => assertBatchTransition('parsed', 'failed', '   ')).toThrow(AppError);
  });

  it('rejects an unknown source status', () => {
    expect(() => assertBatchTransition('banana', 'parsed')).toThrow(/Unknown import status/);
  });
});

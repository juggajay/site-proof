import { describe, expect, it } from 'vitest';
import {
  buildEmptyTestResultsListResponse,
  buildTestResultsListResponse,
} from './listResponses.js';

describe('test result list response helpers', () => {
  it('preserves the paginated list response shape', () => {
    const testResults = [
      { id: 'test-1', testType: 'compaction' },
      { id: 'test-2', testType: 'concrete_strength' },
    ];
    const pagination = { page: 1, limit: 20, total: 2, totalPages: 1 };

    expect(buildTestResultsListResponse(testResults, pagination)).toEqual({
      testResults,
      pagination,
    });
  });

  it('preserves the empty early-return response used for unassigned subcontractor scopes', () => {
    expect(buildEmptyTestResultsListResponse()).toEqual({ testResults: [] });
  });
});

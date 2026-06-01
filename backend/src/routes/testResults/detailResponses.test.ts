import { describe, expect, it } from 'vitest';
import {
  buildTestResultCreatedResponse,
  buildTestResultDeletedResponse,
  buildTestResultDetailResponse,
  buildTestResultUpdatedResponse,
} from './detailResponses.js';

describe('test result detail response helpers', () => {
  it('wraps a fetched test result under the existing response key', () => {
    const testResult = { id: 'test-1', status: 'pending' };

    expect(buildTestResultDetailResponse(testResult)).toEqual({ testResult });
  });

  it('wraps a created test result under the existing response key', () => {
    const testResult = { id: 'test-new', status: 'pending' };

    expect(buildTestResultCreatedResponse(testResult)).toEqual({ testResult });
  });

  it('wraps an updated test result under the existing response key', () => {
    const testResult = { id: 'test-2', status: 'entered' };

    expect(buildTestResultUpdatedResponse(testResult)).toEqual({ testResult });
  });

  it('preserves the delete success message', () => {
    expect(buildTestResultDeletedResponse()).toEqual({
      message: 'Test result deleted successfully',
    });
  });
});

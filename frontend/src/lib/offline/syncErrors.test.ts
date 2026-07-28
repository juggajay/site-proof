// Unit tests for the plain-English sync-failure vocabulary. Pure, no mocks.
import { describe, expect, it } from 'vitest';
import { describeSyncFailure, humanSyncErrorText } from './syncErrors';

describe('humanSyncErrorText', () => {
  it('unwraps the backend { error: { message } } envelope', () => {
    expect(humanSyncErrorText('{"error":{"message":"Diary already submitted","code":"X"}}')).toBe(
      'Diary already submitted',
    );
  });

  it('unwraps a bare { message } body', () => {
    expect(humanSyncErrorText('{"message":"Lot not found"}')).toBe('Lot not found');
  });

  it('passes a plain sentence through untouched', () => {
    expect(humanSyncErrorText('network down')).toBe('network down');
  });

  it('returns undefined for empty / missing text', () => {
    expect(humanSyncErrorText(undefined)).toBeUndefined();
    expect(humanSyncErrorText('   ')).toBeUndefined();
  });

  it('never returns raw JSON it cannot read a message out of', () => {
    expect(humanSyncErrorText('{"detail":[1,2,3]}')).toBe('{"detail":[1,2,3]}');
  });
});

describe('describeSyncFailure', () => {
  it('maps the statuses a foreman actually hits to sentences', () => {
    expect(describeSyncFailure(404, 'Not Found')).toBe(
      'The thing this was attached to was deleted.',
    );
    expect(describeSyncFailure(403, 'Forbidden')).toBe("You don't have permission to save this.");
    expect(describeSyncFailure(409, 'Conflict')).toBe(
      'Someone else changed this while you were offline.',
    );
    expect(describeSyncFailure(401, 'x')).toContain('sign-in');
    expect(describeSyncFailure(400, 'x')).toContain("wouldn't accept");
    expect(describeSyncFailure(422, 'x')).toContain('not valid');
  });

  it('falls back to the server sentence for an unmapped status', () => {
    expect(describeSyncFailure(451, '{"error":{"message":"Blocked by policy"}}')).toBe(
      'Blocked by policy',
    );
  });

  it('never renders a bare status code with no words', () => {
    expect(describeSyncFailure(418)).toBe('The server refused this change (error 418).');
  });
});

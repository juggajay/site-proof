import { describe, expect, it } from 'vitest';
import {
  isDuplicateHpRecipient,
  isValidEmail,
  normalizeHpRecipient,
} from './notificationSettingsHelpers';

describe('isValidEmail', () => {
  it('accepts standard addresses', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('first.last+tag@sub.example.com.au')).toBe(true);
  });

  it('rejects blank, missing @, missing dot, and whitespace addresses', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('userexample.com')).toBe(false);
    expect(isValidEmail('user@example')).toBe(false);
    expect(isValidEmail('user @example.com')).toBe(false);
    expect(isValidEmail('user@ example.com')).toBe(false);
  });
});

describe('normalizeHpRecipient', () => {
  it('trims the role and trims/lowercases the email', () => {
    expect(
      normalizeHpRecipient({ role: '  Superintendent  ', email: '  John@Example.COM ' }),
    ).toEqual({ role: 'Superintendent', email: 'john@example.com' });
  });

  it('preserves role casing', () => {
    expect(normalizeHpRecipient({ role: 'Quality Manager', email: 'qa@example.com' }).role).toBe(
      'Quality Manager',
    );
  });

  it('normalises blank inputs to empty strings', () => {
    expect(normalizeHpRecipient({ role: '   ', email: '   ' })).toEqual({ role: '', email: '' });
  });
});

describe('isDuplicateHpRecipient', () => {
  const recipients = [
    { role: 'Superintendent', email: 'Super@Example.com' },
    { role: 'Quality Manager', email: 'qa@example.com' },
  ];

  it('matches when the role is identical and the stored email matches lowercased', () => {
    expect(
      isDuplicateHpRecipient(recipients, { role: 'Superintendent', email: 'super@example.com' }),
    ).toBe(true);
  });

  it('matches role case variants for the same email', () => {
    expect(
      isDuplicateHpRecipient(recipients, { role: 'superintendent', email: 'super@example.com' }),
    ).toBe(true);
  });

  it('returns false for a different email or an empty list', () => {
    expect(
      isDuplicateHpRecipient(recipients, { role: 'Superintendent', email: 'other@example.com' }),
    ).toBe(false);
    expect(isDuplicateHpRecipient([], { role: 'Superintendent', email: 'super@example.com' })).toBe(
      false,
    );
  });
});

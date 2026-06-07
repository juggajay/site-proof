import { describe, it, expect } from 'vitest';
import { maskInvitedEmail } from './subcontractorInvitations.js';

describe('maskInvitedEmail', () => {
  it('keeps the first letter of the local part and the full domain', () => {
    expect(maskInvitedEmail('bob@oldco.com')).toBe('b***@oldco.com');
  });

  it('masks regardless of local-part length', () => {
    expect(maskInvitedEmail('a@example.com')).toBe('a***@example.com');
    expect(maskInvitedEmail('verylongname@example.com')).toBe('v***@example.com');
  });

  it('trims surrounding whitespace before masking', () => {
    expect(maskInvitedEmail('  bob@oldco.com  ')).toBe('b***@oldco.com');
  });

  it('never echoes a value without a usable local part', () => {
    expect(maskInvitedEmail('@oldco.com')).toBe('***');
    expect(maskInvitedEmail('not-an-email')).toBe('***');
    expect(maskInvitedEmail('')).toBe('***');
  });
});

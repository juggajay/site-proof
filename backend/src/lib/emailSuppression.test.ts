// Wave E2 — recipient suppression (E.0 threat-model item 16: provider read,
// audited skip, NO CIVOS table). The classifier is the only branch here that a
// DB test cannot reach, because it turns a provider's send response into the
// "decision vs transport problem" distinction `[E-j]` rests on: a suppressed
// send consumes a chase attempt, a failed one does not.

import { beforeEach, describe, expect, it } from 'vitest';

import {
  isEmailSuppressed,
  isSuppressionFailure,
  normalizeRecipientEmail,
  recordEmailSuppression,
  resetEmailSuppressionForTests,
} from './emailSuppression.js';

beforeEach(() => {
  resetEmailSuppressionForTests();
});

describe('normalizeRecipientEmail', () => {
  it('trims and lowercases, so first-seen casing cannot split one human in two', () => {
    // E.0 item 12a: the stored value keeps first-seen casing, so `Sam@x.com`
    // and `sam@x.com` are two stored values and one person.
    expect(normalizeRecipientEmail('  Sam@Example.COM ')).toBe('sam@example.com');
    expect(normalizeRecipientEmail('sam@example.com')).toBe(
      normalizeRecipientEmail('SAM@EXAMPLE.COM'),
    );
  });
});

describe('recordEmailSuppression / isEmailSuppressed', () => {
  it('suppresses on the normalized address, whatever casing is asked about', () => {
    expect(isEmailSuppressed('super@example.com')).toBe(false);
    recordEmailSuppression('Super@Example.com', 'hard_bounce');
    expect(isEmailSuppressed('super@example.com')).toBe(true);
    expect(isEmailSuppressed('  SUPER@EXAMPLE.COM  ')).toBe(true);
  });

  it('leaves other addresses alone', () => {
    recordEmailSuppression('one@example.com', 'complaint');
    expect(isEmailSuppressed('two@example.com')).toBe(false);
  });
});

describe('isSuppressionFailure', () => {
  it.each([
    ['hard bounce', 'bounced', undefined],
    ['complaint', 'recipient complained', undefined],
    ['unsubscribe', 'recipient unsubscribed', undefined],
    ['invalid recipient', 'invalid_recipient', undefined],
    ['invalid to', undefined, 'invalid_to'],
    ['suppression list', 'address is on the suppression list', undefined],
    ['no such mailbox', 'mailbox unavailable', undefined],
    ['unknown address', 'user does not exist', undefined],
  ])('treats %s as a delivery DECISION (attempt consumed)', (_label, error, code) => {
    expect(isSuppressionFailure(error, code)).toBe(true);
  });

  it.each([
    ['a timeout', 'request timed out', undefined],
    ['a rate limit', 'too many requests', 'rate_limit_exceeded'],
    ['a 500', 'internal server error', undefined],
    ['a missing API key', 'API key is invalid', 'validation_error'],
    ['nothing at all', undefined, undefined],
  ])('treats %s as a TRANSPORT problem (attempt refunded)', (_label, error, code) => {
    // PROOF OF CATCH: if the pattern widened to match these, a provider hiccup
    // would permanently stop CIVOS mailing a real superintendent — and nothing
    // durable records why, because there is deliberately no suppression table.
    expect(isSuppressionFailure(error, code)).toBe(false);
  });
});

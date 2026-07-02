import { describe, expect, it } from 'vitest';

import {
  buildEmailServiceStatus,
  buildTestEmailPayload,
  buildTestEmailSuccessResponse,
} from './emailDiagnostics.js';

// DB-free coverage of the pure email diagnostics builders. They have no
// database, email, env, or access dependencies, so no mocks are needed — we pin
// the exact payload/response strings, fallbacks, and status branches.

const TEST_EMAIL_MESSAGE =
  'This is a test email notification from CIVOS. If you received this email, your email notifications are configured correctly!';

describe('buildTestEmailPayload', () => {
  it('uses the user full name when present', () => {
    expect(buildTestEmailPayload('Jane Doe')).toEqual({
      title: 'Test Notification',
      message: TEST_EMAIL_MESSAGE,
      userName: 'Jane Doe',
      linkUrl: '/settings',
    });
  });

  it('falls back to CIVOS System when the full name is null or empty', () => {
    expect(buildTestEmailPayload(null).userName).toBe('CIVOS System');
    expect(buildTestEmailPayload('').userName).toBe('CIVOS System');
  });
});

describe('buildTestEmailSuccessResponse', () => {
  it('reports Resend delivery when the provider is resend', () => {
    expect(
      buildTestEmailSuccessResponse(
        { provider: 'resend', messageId: 'abc123' },
        'user@example.com',
      ),
    ).toEqual({
      success: true,
      message: 'Test email sent successfully via Resend API',
      messageId: 'abc123',
      sentTo: 'user@example.com',
      provider: 'resend',
    });
  });

  it('reports console logging and falls back to the mock provider otherwise', () => {
    expect(buildTestEmailSuccessResponse({ messageId: undefined }, 'user@example.com')).toEqual({
      success: true,
      message: 'Test email logged to console (Resend API not configured)',
      messageId: undefined,
      sentTo: 'user@example.com',
      provider: 'mock',
    });
  });
});

describe('buildEmailServiceStatus', () => {
  it('reports ready when Resend is configured', () => {
    expect(
      buildEmailServiceStatus({
        resendConfigured: true,
        emailEnabled: true,
        mockEmailEnabled: false,
        productionMisconfigured: false,
      }),
    ).toEqual({
      provider: 'resend',
      resendConfigured: true,
      emailEnabled: true,
      status: 'ready',
      message:
        'Resend API is configured. Live delivery still depends on provider quota and sender-domain status; run production preflight to verify sends.',
    });
  });

  it('reports misconfigured when production email is enabled without Resend', () => {
    expect(
      buildEmailServiceStatus({
        resendConfigured: false,
        emailEnabled: true,
        mockEmailEnabled: false,
        productionMisconfigured: true,
      }),
    ).toEqual({
      provider: null,
      resendConfigured: false,
      emailEnabled: true,
      status: 'misconfigured',
      message:
        'Email delivery is not configured. Set a valid RESEND_API_KEY before using production email workflows.',
    });
  });

  it('reports development when mock email is enabled', () => {
    expect(
      buildEmailServiceStatus({
        resendConfigured: false,
        emailEnabled: true,
        mockEmailEnabled: true,
        productionMisconfigured: false,
      }),
    ).toEqual({
      provider: 'mock',
      resendConfigured: false,
      emailEnabled: true,
      status: 'development',
      message: 'Mock email is enabled for development. Emails are logged to console only.',
    });
  });

  it('reports disabled when nothing is configured', () => {
    expect(
      buildEmailServiceStatus({
        resendConfigured: false,
        emailEnabled: false,
        mockEmailEnabled: false,
        productionMisconfigured: false,
      }),
    ).toEqual({
      provider: null,
      resendConfigured: false,
      emailEnabled: false,
      status: 'disabled',
      message: 'Email delivery is not configured.',
    });
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function loadEmailModule() {
  vi.resetModules();
  return import('./email.js');
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('email service configuration', () => {
  it('fails closed in production when Resend is not configured', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_PROVIDER;
    delete process.env.EMAIL_ENABLED;

    const { sendEmail, getQueuedEmails, isResendConfigured } = await loadEmailModule();

    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Production email',
      text: 'This should not be mocked',
    });

    expect(isResendConfigured()).toBe(false);
    expect(result).toEqual({
      success: false,
      error: 'Email delivery is not configured',
    });
    expect(getQueuedEmails()).toEqual([]);
  });

  it('does not allow EMAIL_PROVIDER=mock in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.EMAIL_PROVIDER = 'mock';
    delete process.env.RESEND_API_KEY;

    const { sendEmail } = await loadEmailModule();

    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Production mock email',
      text: 'This should not be mocked',
    });

    expect(result.success).toBe(false);
    expect(result.provider).toBeUndefined();
  });

  it('allows mock email delivery outside production', async () => {
    process.env.NODE_ENV = 'development';
    process.env.EMAIL_PROVIDER = 'mock';
    delete process.env.RESEND_API_KEY;

    const { sendEmail, getQueuedEmails, isResendConfigured } = await loadEmailModule();

    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Development email',
      text: 'This may be mocked',
    });

    expect(isResendConfigured()).toBe(false);
    expect(result.success).toBe(true);
    expect(result.provider).toBe('mock');
    expect(result.messageId).toMatch(
      /^mock_\d+_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(getQueuedEmails()).toHaveLength(1);
  });

  it('redacts one-time email action links from development console logs', async () => {
    process.env.NODE_ENV = 'development';
    process.env.EMAIL_PROVIDER = 'mock';
    delete process.env.RESEND_API_KEY;
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const {
      sendMagicLinkEmail,
      sendPasswordResetEmail,
      sendSubcontractorInvitationEmail,
      sendVerificationEmail,
    } = await loadEmailModule();

    await sendVerificationEmail({
      to: 'verify@example.com',
      verificationUrl: 'http://localhost:5174/verify-email?token=verify-secret-token',
    });
    await sendPasswordResetEmail({
      to: 'reset@example.com',
      resetUrl: 'http://localhost:5174/reset-password?token=reset-secret-token',
    });
    await sendMagicLinkEmail({
      to: 'magic@example.com',
      magicLinkUrl: 'http://localhost:5174/auth/magic-link?token=magic-secret-token',
      expiresInMinutes: 15,
    });
    await sendSubcontractorInvitationEmail({
      to: 'invite@example.com',
      contactName: 'Invitee',
      companyName: 'Subcontractor Co',
      projectName: 'Project',
      inviterEmail: 'owner@example.com',
      inviteUrl: 'http://localhost:5174/subcontractor-portal/accept-invite?id=invite-secret-id',
    });

    const logs = JSON.stringify(logSpy.mock.calls);
    expect(logs).toContain('Prepared email verification');
    expect(logs).toContain('recipientCount');
    expect(logs).not.toContain('verify-secret-token');
    expect(logs).not.toContain('reset-secret-token');
    expect(logs).not.toContain('magic-secret-token');
    expect(logs).not.toContain('invite-secret-id');
  });

  it('escapes dynamic values in generated HTML emails', async () => {
    process.env.NODE_ENV = 'development';
    process.env.EMAIL_PROVIDER = 'mock';
    delete process.env.RESEND_API_KEY;
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const {
      getQueuedEmails,
      sendDailyDigestEmail,
      sendHPReleaseRequestEmail,
      sendNotificationEmail,
      sendSubcontractorInvitationEmail,
      sendVerificationEmail,
    } = await loadEmailModule();

    const htmlAttack = '<img src=x onerror="alert(1)">';
    const scriptAttack = '<script>alert(1)</script>';
    const urlAttack = 'http://localhost:5174/action?token="><script>alert(1)</script>';

    await sendNotificationEmail('recipient@example.com', htmlAttack, {
      title: htmlAttack,
      message: scriptAttack,
      projectName: htmlAttack,
      userName: htmlAttack,
    });
    await sendSubcontractorInvitationEmail({
      to: 'recipient@example.com',
      contactName: htmlAttack,
      companyName: htmlAttack,
      projectName: htmlAttack,
      inviterEmail: htmlAttack,
      inviteUrl: urlAttack,
    });
    await sendHPReleaseRequestEmail({
      to: 'recipient@example.com',
      superintendentName: htmlAttack,
      projectName: htmlAttack,
      lotNumber: htmlAttack,
      holdPointDescription: scriptAttack,
      releaseUrl: urlAttack,
      requestedBy: htmlAttack,
      noticeOverrideReason: scriptAttack,
    });
    await sendDailyDigestEmail('recipient@example.com', [
      {
        type: 'mention',
        title: htmlAttack,
        message: scriptAttack,
        projectName: htmlAttack,
        linkUrl: '/dashboard?token="><img src=x onerror=1>',
        timestamp: new Date(),
      },
    ]);
    await sendVerificationEmail({
      to: 'recipient@example.com',
      userName: htmlAttack,
      verificationUrl: urlAttack,
    });

    const htmlBodies = getQueuedEmails()
      .map((email) => email.html ?? '')
      .join('\n');

    expect(htmlBodies).toContain('&lt;img');
    expect(htmlBodies).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(htmlBodies).toContain('&quot;&gt;');
    expect(htmlBodies).not.toContain('<img src=x');
    expect(htmlBodies).not.toContain('<script>');
    expect(htmlBodies).not.toContain('onerror="alert(1)"');
  });
});

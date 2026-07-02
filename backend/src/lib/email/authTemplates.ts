import { logInfo } from '../serverLogger.js';

type AuthEmailOptions = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
};

type AuthEmailResult = {
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: 'resend' | 'mock';
};

type AuthEmailDependencies = {
  sendEmail: (options: AuthEmailOptions) => Promise<AuthEmailResult>;
  escapeEmailHtml: (value: unknown) => string;
};

export type VerificationEmailData = {
  to: string;
  userName?: string;
  verificationUrl: string;
  expiresInHours?: number;
};

export type PasswordResetEmailData = {
  to: string;
  userName?: string;
  resetUrl: string;
  expiresInMinutes?: number;
};

export type MagicLinkEmailData = {
  to: string;
  userName?: string;
  magicLinkUrl: string;
  expiresInMinutes: number;
};

/**
 * Send email verification email
 * Sent when a user registers or requests a new verification link
 */
export async function sendVerificationEmail(
  data: VerificationEmailData,
  { sendEmail, escapeEmailHtml }: AuthEmailDependencies,
): Promise<AuthEmailResult> {
  const expiresIn = data.expiresInHours || 24;
  const subject = `[CIVOS] Verify your email address`;
  const safeSubject = escapeEmailHtml(subject);
  const safeUserName = data.userName ? escapeEmailHtml(data.userName) : '';
  const safeVerificationUrl = escapeEmailHtml(data.verificationUrl);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeSubject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .button { display: inline-block; background: #16a34a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; font-size: 16px; }
    .button:hover { opacity: 0.9; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background: #f3f4f6; border-radius: 0 0 8px 8px; }
    .warning { background: #fef3c7; padding: 12px; border-radius: 6px; border-left: 4px solid #f59e0b; margin: 15px 0; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Verify Your Email</h1>
    </div>
    <div class="content">
      <h2 style="margin-top: 0;">Hi${safeUserName ? ` ${safeUserName}` : ''},</h2>

      <p>Thanks for signing up for CIVOS! Please verify your email address by clicking the button below.</p>

      <div style="text-align: center;">
        <a href="${safeVerificationUrl}" class="button">
          Verify Email Address
        </a>
      </div>

      <div class="warning">
        <strong>This link expires in ${expiresIn} hours.</strong><br>
        If you didn't create an account, you can safely ignore this email.
      </div>

      <p style="color: #6b7280; font-size: 14px;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <span style="word-break: break-all;">${safeVerificationUrl}</span>
      </p>
    </div>
    <div class="footer">
      <p>This verification link was sent from CIVOS.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Hi${data.userName ? ` ${data.userName}` : ''},

Thanks for signing up for CIVOS! Please verify your email address by clicking the link below.

${data.verificationUrl}

This link expires in ${expiresIn} hours.

If you didn't create an account, you can safely ignore this email.

---
This verification link was sent from CIVOS.
  `;

  if (process.env.NODE_ENV !== 'production') {
    logInfo('[Email Service] Prepared email verification:', { recipientCount: 1 });
  }

  return sendEmail({
    to: data.to,
    subject,
    html,
    text,
  });
}

/**
 * Send password reset email
 * Sent when a user requests to reset their password
 */
export async function sendPasswordResetEmail(
  data: PasswordResetEmailData,
  { sendEmail, escapeEmailHtml }: AuthEmailDependencies,
): Promise<AuthEmailResult> {
  const expiresIn = data.expiresInMinutes || 60;
  const subject = `[CIVOS] Reset your password`;
  const safeSubject = escapeEmailHtml(subject);
  const safeUserName = data.userName ? escapeEmailHtml(data.userName) : '';
  const safeResetUrl = escapeEmailHtml(data.resetUrl);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeSubject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .button { display: inline-block; background: #dc2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; font-size: 16px; }
    .button:hover { opacity: 0.9; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background: #f3f4f6; border-radius: 0 0 8px 8px; }
    .warning { background: #fef3c7; padding: 12px; border-radius: 6px; border-left: 4px solid #f59e0b; margin: 15px 0; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Reset Your Password</h1>
    </div>
    <div class="content">
      <h2 style="margin-top: 0;">Hi${safeUserName ? ` ${safeUserName}` : ''},</h2>

      <p>We received a request to reset your password. Click the button below to create a new password.</p>

      <div style="text-align: center;">
        <a href="${safeResetUrl}" class="button">
          Reset Password
        </a>
      </div>

      <div class="warning">
        <strong>This link expires in ${expiresIn} minutes.</strong><br>
        If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
      </div>

      <p style="color: #6b7280; font-size: 14px;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <span style="word-break: break-all;">${safeResetUrl}</span>
      </p>
    </div>
    <div class="footer">
      <p>This password reset was requested from CIVOS.</p>
      <p>For security reasons, this link can only be used once.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Hi${data.userName ? ` ${data.userName}` : ''},

We received a request to reset your password. Click the link below to create a new password.

${data.resetUrl}

This link expires in ${expiresIn} minutes.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

---
This password reset was requested from CIVOS.
For security reasons, this link can only be used once.
  `;

  if (process.env.NODE_ENV !== 'production') {
    logInfo('[Email Service] Prepared password reset email:', { recipientCount: 1 });
  }

  return sendEmail({
    to: data.to,
    subject,
    html,
    text,
  });
}

/**
 * Send magic link login email (Feature #1005)
 * Passwordless login via email link
 */
export async function sendMagicLinkEmail(
  data: MagicLinkEmailData,
  { sendEmail, escapeEmailHtml }: AuthEmailDependencies,
): Promise<AuthEmailResult> {
  const subject = `[CIVOS] Your Login Link`;
  const safeSubject = escapeEmailHtml(subject);
  const safeUserName = data.userName ? escapeEmailHtml(data.userName) : '';
  const safeMagicLinkUrl = escapeEmailHtml(data.magicLinkUrl);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeSubject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .button { display: inline-block; background: #16a34a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; font-size: 16px; }
    .button:hover { opacity: 0.9; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background: #f3f4f6; border-radius: 0 0 8px 8px; }
    .warning { background: #fef3c7; padding: 12px; border-radius: 6px; border-left: 4px solid #f59e0b; margin: 15px 0; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Sign In to CIVOS</h1>
    </div>
    <div class="content">
      <h2 style="margin-top: 0;">Hi${safeUserName ? ` ${safeUserName}` : ''},</h2>

      <p>Click the button below to sign in to your CIVOS account. No password needed!</p>

      <div style="text-align: center;">
        <a href="${safeMagicLinkUrl}" class="button">
          Sign In to CIVOS
        </a>
      </div>

      <div class="warning">
        <strong>⏰ This link expires in ${data.expiresInMinutes} minutes.</strong><br>
        If you didn't request this link, you can safely ignore this email.
      </div>

      <p style="color: #6b7280; font-size: 14px;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <span style="word-break: break-all;">${safeMagicLinkUrl}</span>
      </p>
    </div>
    <div class="footer">
      <p>This login link was requested from CIVOS.</p>
      <p>For security, this link can only be used once.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Hi${data.userName ? ` ${data.userName}` : ''},

Sign In to CIVOS
--------------------

Click the link below to sign in to your account. No password needed!

${data.magicLinkUrl}

This link expires in ${data.expiresInMinutes} minutes.

If you didn't request this link, you can safely ignore this email.
For security, this link can only be used once.

---
This login link was requested from CIVOS.
  `;

  if (process.env.NODE_ENV !== 'production') {
    logInfo('[Email Service] Prepared magic link login email:', { recipientCount: 1 });
  }

  return sendEmail({
    to: data.to,
    subject,
    html,
    text,
  });
}

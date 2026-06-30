export type CompanyMemberInvitationEmailData = {
  to: string;
  userName?: string | null;
  companyName: string;
  inviterEmail: string;
  setupUrl: string;
  expiresInDays: number;
};

type CompanyMemberInvitationTemplateDependencies = {
  escapeEmailHtml: (value: unknown) => string;
};

type RenderedCompanyMemberInvitationEmail = {
  subject: string;
  html: string;
  text: string;
};

function sanitizeEmailSubjectLine(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function renderCompanyMemberInvitationEmail(
  data: CompanyMemberInvitationEmailData,
  { escapeEmailHtml }: CompanyMemberInvitationTemplateDependencies,
): RenderedCompanyMemberInvitationEmail {
  const subject = `[SiteProof] Invitation to join ${sanitizeEmailSubjectLine(data.companyName) || 'your company'}`;
  const safeSubject = escapeEmailHtml(subject);
  const safeUserName = data.userName ? escapeEmailHtml(data.userName) : '';
  const safeCompanyName = escapeEmailHtml(data.companyName);
  const safeInviterEmail = escapeEmailHtml(data.inviterEmail);
  const safeSetupUrl = escapeEmailHtml(data.setupUrl);

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
    .button { display: inline-block; background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; font-size: 16px; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background: #f3f4f6; border-radius: 0 0 8px 8px; }
    .warning { background: #fef3c7; padding: 12px; border-radius: 6px; border-left: 4px solid #f59e0b; margin: 15px 0; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>You're invited to SiteProof</h1>
    </div>
    <div class="content">
      <h2 style="margin-top: 0;">Hi${safeUserName ? ` ${safeUserName}` : ''},</h2>

      <p><strong>${safeInviterEmail}</strong> has invited you to join <strong>${safeCompanyName}</strong> on SiteProof.</p>

      <p>Set your password to activate your company account and start working on assigned projects.</p>

      <div style="text-align: center;">
        <a href="${safeSetupUrl}" class="button">Accept Invitation</a>
      </div>

      <div class="warning">
        <strong>This link expires in ${data.expiresInDays} days.</strong><br>
        If you were not expecting this invitation, contact the sender.
      </div>

      <p style="color: #6b7280; font-size: 14px;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <span style="word-break: break-all;">${safeSetupUrl}</span>
      </p>
    </div>
    <div class="footer">
      <p>This invitation was sent from SiteProof.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Hi${data.userName ? ` ${data.userName}` : ''},

${data.inviterEmail} has invited you to join ${data.companyName} on SiteProof.

Set your password to activate your company account:
${data.setupUrl}

This link expires in ${data.expiresInDays} days.

If you were not expecting this invitation, contact the sender.
  `;

  return { subject, html, text };
}

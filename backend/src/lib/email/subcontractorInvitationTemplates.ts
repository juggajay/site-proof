export type SubcontractorInvitationEmailData = {
  to: string;
  contactName: string;
  companyName: string;
  projectName: string;
  inviterEmail: string;
  inviteUrl: string;
};

type SubcontractorInvitationTemplateDependencies = {
  escapeEmailHtml: (value: unknown) => string;
  sanitizeSupportEmailLine: (value: string | undefined, fallback?: string) => string;
};

type RenderedSubcontractorInvitationEmail = {
  subject: string;
  html: string;
  text: string;
};

export function renderSubcontractorInvitationEmail(
  data: SubcontractorInvitationEmailData,
  { escapeEmailHtml, sanitizeSupportEmailLine }: SubcontractorInvitationTemplateDependencies,
): RenderedSubcontractorInvitationEmail {
  const subjectProjectName = sanitizeSupportEmailLine(data.projectName, 'Project');
  const subject = `[CIVOS] Invitation to join ${subjectProjectName}`;
  const safeSubject = escapeEmailHtml(subject);
  const safeContactName = escapeEmailHtml(data.contactName);
  const safeCompanyName = escapeEmailHtml(data.companyName);
  const safeProjectName = escapeEmailHtml(data.projectName);
  const safeInviterEmail = escapeEmailHtml(data.inviterEmail);
  const safeInviteUrl = escapeEmailHtml(data.inviteUrl);

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
    .message-box { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0; }
    .button { display: inline-block; background: #16a34a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 15px 0; font-size: 16px; }
    .button:hover { background: #15803d; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background: #f3f4f6; border-radius: 0 0 8px 8px; }
    .highlight { background: #fef3c7; padding: 12px; border-radius: 6px; border-left: 4px solid #f59e0b; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏗️ CIVOS</h1>
      <p style="margin: 5px 0 0 0;">Subcontractor Portal Invitation</p>
    </div>
    <div class="content">
      <h2 style="margin-top: 0;">Hi ${safeContactName},</h2>
      <div class="message-box">
        <p>You have been invited to join the project <strong>"${safeProjectName}"</strong> on CIVOS as a subcontractor for <strong>${safeCompanyName}</strong>.</p>
        <p>CIVOS is a quality management platform that helps civil construction teams track lots, manage ITPs, and submit daily dockets.</p>
      </div>
      <div class="highlight">
        <strong>📋 What you'll be able to do:</strong>
        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
          <li>View lots assigned to your company</li>
          <li>Submit daily dockets for time, plant, and materials</li>
          <li>Complete ITP checklist items</li>
          <li>Upload photos and documents</li>
        </ul>
      </div>
      <div style="text-align: center; margin: 25px 0;">
        <a href="${safeInviteUrl}" class="button">
          Accept Invitation & Set Up Account
        </a>
      </div>
      <p style="color: #6b7280; font-size: 14px;">
        This invitation was sent by <strong>${safeInviterEmail}</strong>.
      </p>
    </div>
    <div class="footer">
      <p>This invitation was sent from CIVOS Quality Management System.</p>
      <p>If you were not expecting this invitation, please contact the sender.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Hi ${data.contactName},

You have been invited to join the project "${data.projectName}" on CIVOS as a subcontractor for ${data.companyName}.

CIVOS is a quality management platform that helps civil construction teams track lots, manage ITPs, and submit daily dockets.

What you'll be able to do:
- View lots assigned to your company
- Submit daily dockets for time, plant, and materials
- Complete ITP checklist items
- Upload photos and documents

Click the link below to accept your invitation and set up your account:
${data.inviteUrl}

This invitation was sent by ${data.inviterEmail}.

---
If you were not expecting this invitation, please contact the sender.
  `;

  return { subject, html, text };
}

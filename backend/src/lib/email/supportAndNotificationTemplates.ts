interface SupportRequestTemplateData {
  ticketId: string;
  category: string;
  subject: string;
  message: string;
  userEmail?: string;
  userName?: string;
}

interface NotificationTemplateData {
  title: string;
  message: string;
  linkUrl?: string;
  projectName?: string;
  userName?: string;
}

interface NotificationTemplateUrls {
  notificationLinkUrl: string;
  settingsUrl: string;
}

const EMAIL_HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function sanitizeSupportEmailLine(value: string | undefined, fallback = 'Not provided'): string {
  const normalized = value
    ?.replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return normalized || fallback;
}

function escapeEmailHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => EMAIL_HTML_ENTITIES[character]);
}

export function renderSupportRequestEmail(data: SupportRequestTemplateData): {
  subject: string;
  text: string;
} {
  const safeTicketId = sanitizeSupportEmailLine(data.ticketId, 'Unknown ticket');
  const safeCategory = sanitizeSupportEmailLine(data.category, 'general');
  const safeSubject = sanitizeSupportEmailLine(data.subject, 'No subject');
  const safeUserEmail = sanitizeSupportEmailLine(data.userEmail);
  const safeUserName = sanitizeSupportEmailLine(data.userName);

  const text = [
    `Ticket: ${safeTicketId}`,
    `Category: ${safeCategory}`,
    `Subject: ${safeSubject}`,
    `User email: ${safeUserEmail}`,
    `User name: ${safeUserName}`,
    '',
    'Message:',
    data.message,
  ].join('\n');

  return {
    subject: `[SiteProof Support] ${safeTicketId}: ${safeSubject}`,
    text,
  };
}

export function renderNotificationEmail(
  notificationType: string,
  data: NotificationTemplateData,
  urls: NotificationTemplateUrls,
): {
  subject: string;
  html: string;
  text: string;
} {
  const subjectTitle = sanitizeSupportEmailLine(data.title, 'Notification');
  const subject = `[SiteProof] ${subjectTitle}`;
  const safeSubject = escapeEmailHtml(subject);
  const safeTitle = escapeEmailHtml(data.title);
  const safeMessage = escapeEmailHtml(data.message);
  const safeProjectName = data.projectName ? escapeEmailHtml(data.projectName) : '';
  const safeUserName = data.userName ? escapeEmailHtml(data.userName) : '';
  const safeNotificationType = escapeEmailHtml(notificationType);
  const safeNotificationLinkUrl = urls.notificationLinkUrl
    ? escapeEmailHtml(urls.notificationLinkUrl)
    : '';
  const safeSettingsUrl = escapeEmailHtml(urls.settingsUrl);

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
    .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 15px 0; }
    .button:hover { background: #1d4ed8; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background: #f3f4f6; border-radius: 0 0 8px 8px; }
    .meta { color: #6b7280; font-size: 14px; margin-bottom: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>SiteProof</h1>
    </div>
    <div class="content">
      <h2 style="margin-top: 0;">${safeTitle}</h2>
      ${safeProjectName ? `<p class="meta">Project: ${safeProjectName}</p>` : ''}
      ${safeUserName ? `<p class="meta">From: ${safeUserName}</p>` : ''}
      <div class="message-box">
        <p>${safeMessage}</p>
      </div>
      ${
        safeNotificationLinkUrl
          ? `
        <a href="${safeNotificationLinkUrl}" class="button">
          View in SiteProof
        </a>
      `
          : ''
      }
    </div>
    <div class="footer">
      <p>This notification was sent from SiteProof Quality Management System.</p>
      <p>You received this email because you have notifications enabled for ${safeNotificationType} events.</p>
      <p>To manage your notification preferences, visit your <a href="${safeSettingsUrl}">Settings</a>.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
${data.title}

${data.projectName ? `Project: ${data.projectName}` : ''}
${data.userName ? `From: ${data.userName}` : ''}

${data.message}

${urls.notificationLinkUrl ? `View in SiteProof: ${urls.notificationLinkUrl}` : ''}

---
This notification was sent from SiteProof Quality Management System.
To manage your notification preferences, visit: ${urls.settingsUrl}
  `;

  return {
    subject,
    html,
    text,
  };
}

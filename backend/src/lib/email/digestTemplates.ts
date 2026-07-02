type DigestEmailOptions = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
};

type DigestEmailResult = {
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: 'resend' | 'mock';
};

type DigestEmailDependencies = {
  sendEmail: (options: DigestEmailOptions) => Promise<DigestEmailResult>;
  escapeEmailHtml: (value: unknown) => string;
  buildFrontendUrl: (path: string) => string;
};

/**
 * Digest notification item
 */
export interface DigestItem {
  type: string;
  title: string;
  message: string;
  projectName?: string;
  linkUrl?: string;
  timestamp: Date;
}

/**
 * Send daily digest email
 */
export async function sendDailyDigestEmail(
  to: string,
  items: DigestItem[],
  { sendEmail, escapeEmailHtml, buildFrontendUrl }: DigestEmailDependencies,
): Promise<DigestEmailResult> {
  if (items.length === 0) {
    return { success: false, error: 'No items in digest' };
  }

  const subject = `[CIVOS] Daily Digest - ${items.length} notification${items.length > 1 ? 's' : ''}`;
  const safeSubject = escapeEmailHtml(subject);
  const today = new Date().toLocaleDateString('en-AU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const dashboardUrl = buildFrontendUrl('/dashboard');
  const settingsUrl = buildFrontendUrl('/settings');
  const safeToday = escapeEmailHtml(today);
  const safeDashboardUrl = escapeEmailHtml(dashboardUrl);
  const safeSettingsUrl = escapeEmailHtml(settingsUrl);

  // Group items by project
  const itemsByProject = items.reduce(
    (acc, item) => {
      const project = item.projectName || 'General';
      if (!acc[project]) {
        acc[project] = [];
      }
      acc[project].push(item);
      return acc;
    },
    {} as Record<string, DigestItem[]>,
  );

  const projectSections = Object.entries(itemsByProject)
    .map(([project, projectItems]) => {
      const itemsHtml = projectItems
        .map(
          (item) => `
      <div style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
        <div style="font-weight: 500; color: #374151;">${escapeEmailHtml(item.title)}</div>
        <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">${escapeEmailHtml(item.message)}</div>
        ${
          item.linkUrl
            ? `
          <a href="${escapeEmailHtml(buildFrontendUrl(item.linkUrl))}"
             style="display: inline-block; margin-top: 8px; color: #2563eb; text-decoration: none; font-size: 14px;">
            View Details →
          </a>
        `
            : ''
        }
      </div>
    `,
        )
        .join('');

      return `
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 12px 0; padding: 8px 12px; background: #f3f4f6; border-radius: 6px; font-size: 14px; color: #374151;">
          📁 ${escapeEmailHtml(project)}
        </h3>
        ${itemsHtml}
      </div>
    `;
    })
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeSubject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="margin: 0; font-size: 24px;">📬 Daily Digest</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.9;">${safeToday}</p>
    </div>
    <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb;">
      <div style="background: white; padding: 16px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e5e7eb;">
        <p style="margin: 0; font-size: 16px;">
          You have <strong>${items.length}</strong> notification${items.length > 1 ? 's' : ''} from today.
        </p>
      </div>

      ${projectSections}

      <div style="text-align: center; margin-top: 24px;">
        <a href="${safeDashboardUrl}"
           style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
          View All in CIVOS
        </a>
      </div>
    </div>
    <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background: #f3f4f6; border-radius: 0 0 8px 8px;">
      <p style="margin: 0;">This is your daily digest from CIVOS Quality Management System.</p>
      <p style="margin: 8px 0 0 0;">
        To manage your notification preferences, visit your
        <a href="${safeSettingsUrl}" style="color: #2563eb;">Settings</a>.
      </p>
    </div>
  </div>
</body>
</html>
  `;

  const itemsList = items
    .map(
      (item) =>
        `- ${item.title}: ${item.message}${item.linkUrl ? ` (${buildFrontendUrl(item.linkUrl)})` : ''}`,
    )
    .join('\n');

  const text = `
Daily Digest - ${today}

You have ${items.length} notification${items.length > 1 ? 's' : ''} from today:

${itemsList}

---
View all in CIVOS: ${dashboardUrl}
To manage your notification preferences, visit: ${settingsUrl}
  `;

  return sendEmail({
    to,
    subject,
    html,
    text,
  });
}

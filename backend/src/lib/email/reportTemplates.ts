import { logInfo } from '../serverLogger.js';

type ReportEmailAttachment = {
  filename: string;
  content?: Buffer | string;
  path?: string;
  contentType?: string;
};

type ReportEmailOptions = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  attachments?: ReportEmailAttachment[];
};

type ReportEmailResult = {
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: 'resend' | 'mock';
};

type ReportEmailDependencies = {
  sendEmail: (options: ReportEmailOptions) => Promise<ReportEmailResult>;
  escapeEmailHtml: (value: unknown) => string;
  sanitizeSupportEmailLine: (value: string | undefined, fallback?: string) => string;
};

export type ScheduledReportEmailData = {
  to: string | string[];
  recipientName?: string;
  projectName: string;
  reportType: string;
  reportName: string;
  generatedAt: string;
  dateRange?: { from: string; to: string };
  pdfBuffer?: Buffer;
  pdfPath?: string;
  viewReportUrl?: string;
};

/**
 * Send scheduled report email with PDF attachment (Feature #1016)
 */
export async function sendScheduledReportEmail(
  data: ScheduledReportEmailData,
  { sendEmail, escapeEmailHtml, sanitizeSupportEmailLine }: ReportEmailDependencies,
): Promise<ReportEmailResult> {
  const subjectReportName = sanitizeSupportEmailLine(data.reportName, 'Report');
  const subject = `[SiteProof] Scheduled Report: ${subjectReportName}`;
  const safeSubject = escapeEmailHtml(subject);
  const safeRecipientName = data.recipientName ? escapeEmailHtml(data.recipientName) : '';
  const safeProjectName = escapeEmailHtml(data.projectName);
  const safeReportType = escapeEmailHtml(data.reportType);
  const safeReportName = escapeEmailHtml(data.reportName);
  const safeGeneratedAt = escapeEmailHtml(data.generatedAt);
  const safeDateFrom = data.dateRange ? escapeEmailHtml(data.dateRange.from) : '';
  const safeDateTo = data.dateRange ? escapeEmailHtml(data.dateRange.to) : '';
  const safeViewReportUrl = data.viewReportUrl ? escapeEmailHtml(data.viewReportUrl) : '';
  const hasAttachment = Boolean(data.pdfBuffer || data.pdfPath);

  const dateRangeText = data.dateRange
    ? `<div class="detail-row"><strong>📅 Date Range:</strong> ${safeDateFrom} to ${safeDateTo}</div>`
    : '';
  const attachmentNotice = hasAttachment
    ? `
      <div class="attachment-notice">
        <strong>📎 Attachment:</strong> ${safeReportName}.pdf
      </div>
    `
    : '';

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
    .detail-row { padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
    .detail-row:last-child { border-bottom: none; }
    .button { display: inline-block; background: #16a34a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px 5px; font-size: 16px; }
    .button:hover { opacity: 0.9; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background: #f3f4f6; border-radius: 0 0 8px 8px; }
    .attachment-notice { background: #dbeafe; color: #1e40af; padding: 12px; border-radius: 6px; margin: 15px 0; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Scheduled Report</h1>
    </div>
    <div class="content">
      <h2 style="margin-top: 0;">Hi${safeRecipientName ? ` ${safeRecipientName}` : ''},</h2>

      <p>Your scheduled report has been generated${hasAttachment ? ' and is attached to this email' : ''}.</p>

      <div class="message-box">
        <div class="detail-row">
          <strong>📋 Report:</strong> ${safeReportName}
        </div>
        <div class="detail-row">
          <strong>📁 Type:</strong> ${safeReportType}
        </div>
        <div class="detail-row">
          <strong>🏗️ Project:</strong> ${safeProjectName}
        </div>
        ${dateRangeText}
        <div class="detail-row">
          <strong>🕒 Generated:</strong> ${safeGeneratedAt}
        </div>
      </div>

      ${attachmentNotice}

      ${
        safeViewReportUrl
          ? `
      <div style="text-align: center; margin: 25px 0;">
        <a href="${safeViewReportUrl}" class="button">
          View Report Online
        </a>
      </div>
      `
          : ''
      }

      <p style="color: #6b7280; font-size: 14px;">
        This is an automated email from your scheduled report settings.
      </p>
    </div>
    <div class="footer">
      <p>This report was generated by SiteProof Quality Management System.</p>
      <p>Project: ${safeProjectName}</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Hi${data.recipientName ? ` ${data.recipientName}` : ''},

Your scheduled report has been generated${hasAttachment ? ' and is attached to this email' : ''}.

REPORT DETAILS
--------------
Report: ${data.reportName}
Type: ${data.reportType}
Project: ${data.projectName}
${data.dateRange ? `Date Range: ${data.dateRange.from} to ${data.dateRange.to}\n` : ''}Generated: ${data.generatedAt}

${
  hasAttachment
    ? `ATTACHMENT
----------
${data.reportName}.pdf

`
    : ''
}${data.viewReportUrl ? `View report online: ${data.viewReportUrl}\n` : ''}

---
This report was generated by SiteProof Quality Management System.
Project: ${data.projectName}
  `;

  // Build attachments array
  const attachments: ReportEmailAttachment[] = [];
  if (data.pdfBuffer) {
    attachments.push({
      filename: `${data.reportName.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`,
      content: data.pdfBuffer,
      contentType: 'application/pdf',
    });
  } else if (data.pdfPath) {
    attachments.push({
      filename: `${data.reportName.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`,
      path: data.pdfPath,
      contentType: 'application/pdf',
    });
  }

  if (process.env.NODE_ENV !== 'production') {
    logInfo('[Email Service] Prepared scheduled report email:', { recipientCount: 1 });
  }

  return sendEmail({
    to: data.to,
    subject,
    html,
    text,
    attachments: attachments.length > 0 ? attachments : undefined,
  });
}

import type { RenderedHoldPointEmail } from './holdPointTemplateUtils.js';
import { escapeEmailHtml, sanitizeSupportEmailLine } from './holdPointTemplateUtils.js';

export interface HoldPointReleaseConfirmationTemplateData {
  recipientName: string;
  recipientRole: 'contractor' | 'superintendent';
  projectName: string;
  lotNumber: string;
  holdPointDescription: string;
  releasedByName: string;
  releasedByOrg?: string;
  releaseMethod?: string;
  releaseNotes?: string;
  releasedAt: string;
  lotUrl: string;
}

export function renderHoldPointReleaseConfirmationEmail(
  data: HoldPointReleaseConfirmationTemplateData,
): RenderedHoldPointEmail {
  const subjectLotNumber = sanitizeSupportEmailLine(data.lotNumber, 'Lot');
  const subject = `[CIVOS] Hold Point Released - ${subjectLotNumber}`;
  const safeSubject = escapeEmailHtml(subject);
  const safeRecipientName = escapeEmailHtml(data.recipientName);
  const safeProjectName = escapeEmailHtml(data.projectName);
  const safeLotNumber = escapeEmailHtml(data.lotNumber);
  const safeHoldPointDescription = escapeEmailHtml(data.holdPointDescription);
  const safeReleasedByName = escapeEmailHtml(data.releasedByName);
  const safeReleasedByOrg = data.releasedByOrg ? escapeEmailHtml(data.releasedByOrg) : '';
  const safeReleaseMethod = data.releaseMethod ? escapeEmailHtml(data.releaseMethod) : '';
  const safeReleaseNotes = data.releaseNotes ? escapeEmailHtml(data.releaseNotes) : '';
  const safeReleasedAt = escapeEmailHtml(data.releasedAt);
  const safeLotUrl = escapeEmailHtml(data.lotUrl);

  const roleSpecificMessage =
    data.recipientRole === 'contractor'
      ? 'You may now proceed with the next phase of work.'
      : 'This is confirmation that the hold point has been released.';

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
    .header { background: #16a34a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .message-box { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0; }
    .detail-row { padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
    .detail-row:last-child { border-bottom: none; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px 5px; font-size: 16px; }
    .button:hover { opacity: 0.9; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background: #f3f4f6; border-radius: 0 0 8px 8px; }
    .success-badge { background: #dcfce7; color: #166534; padding: 12px 20px; border-radius: 8px; text-align: center; margin: 20px 0; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Hold Point Released</h1>
    </div>
    <div class="content">
      <h2 style="margin-top: 0;">Hi ${safeRecipientName},</h2>

      <div class="success-badge">
        The hold point has been released successfully
      </div>

      <p>${roleSpecificMessage}</p>

      <div class="message-box">
        <div class="detail-row">
          <strong>📍 Lot:</strong> ${safeLotNumber}
        </div>
        <div class="detail-row">
          <strong>🔒 Hold Point:</strong> ${safeHoldPointDescription}
        </div>
        <div class="detail-row">
          <strong>✍️ Released By:</strong> ${safeReleasedByName}${safeReleasedByOrg ? ` (${safeReleasedByOrg})` : ''}
        </div>
        <div class="detail-row">
          <strong>📅 Released At:</strong> ${safeReleasedAt}
        </div>
        ${
          safeReleaseMethod
            ? `
        <div class="detail-row">
          <strong>📝 Release Method:</strong> ${safeReleaseMethod}
        </div>
        `
            : ''
        }
        ${
          safeReleaseNotes
            ? `
        <div class="detail-row">
          <strong>📋 Notes:</strong> ${safeReleaseNotes}
        </div>
        `
            : ''
        }
      </div>

      <div style="text-align: center; margin: 25px 0;">
        <a href="${safeLotUrl}" class="button">
          View Lot Details
        </a>
      </div>
    </div>
    <div class="footer">
      <p>This confirmation was sent from CIVOS Quality Management System.</p>
      <p>Project: ${safeProjectName}</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Hi ${data.recipientName},

HOLD POINT RELEASED

The hold point has been released successfully. ${roleSpecificMessage}

RELEASE DETAILS
---------------
Lot: ${data.lotNumber}
Hold Point: ${data.holdPointDescription}
Released By: ${data.releasedByName}${data.releasedByOrg ? ` (${data.releasedByOrg})` : ''}
Released At: ${data.releasedAt}
${data.releaseMethod ? `Release Method: ${data.releaseMethod}\n` : ''}${data.releaseNotes ? `Notes: ${data.releaseNotes}\n` : ''}

View lot details: ${data.lotUrl}

---
This confirmation was sent from CIVOS Quality Management System.
Project: ${data.projectName}
  `;

  return {
    subject,
    html,
    text,
  };
}

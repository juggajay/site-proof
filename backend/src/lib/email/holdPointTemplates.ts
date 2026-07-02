import type { RenderedHoldPointEmail } from './holdPointTemplateUtils.js';
import { escapeEmailHtml, sanitizeSupportEmailLine } from './holdPointTemplateUtils.js';

export { renderHoldPointReleaseConfirmationEmail } from './holdPointConfirmationTemplate.js';
export type { HoldPointReleaseConfirmationTemplateData } from './holdPointConfirmationTemplate.js';

export interface HoldPointReleaseRequestTemplateData {
  superintendentName: string;
  projectName: string;
  lotNumber: string;
  holdPointDescription: string;
  scheduledDate?: string;
  scheduledTime?: string;
  evidencePackageUrl?: string;
  releaseUrl: string;
  secureReleaseUrl?: string;
  requestedBy: string;
  noticeOverrideReason?: string;
}

export interface HoldPointBatchReleaseRequestTemplateData {
  superintendentName: string;
  projectName: string;
  lotNumber: string;
  holdPoints: Array<{
    sequenceNumber?: number | null;
    description: string;
    secureReleaseUrl: string;
    evidencePackageUrl?: string;
  }>;
  scheduledDate?: string;
  scheduledTime?: string;
  releaseUrl: string;
  requestedBy: string;
  noticeHours?: number;
}

export interface HoldPointChaseTemplateData {
  superintendentName: string;
  projectName: string;
  lotNumber: string;
  holdPointDescription: string;
  originalRequestDate: string;
  chaseCount: number;
  daysSinceRequest: number;
  evidencePackageUrl?: string;
  releaseUrl: string;
  requestedBy: string;
}

export function renderHoldPointBatchReleaseRequestEmail(
  data: HoldPointBatchReleaseRequestTemplateData,
): RenderedHoldPointEmail {
  const subjectLotNumber = sanitizeSupportEmailLine(data.lotNumber, 'Lot');
  const subject = `[CIVOS] Batch Hold Point Release Request - ${subjectLotNumber}`;
  const safeSubject = escapeEmailHtml(subject);
  const safeSuperintendentName = escapeEmailHtml(data.superintendentName);
  const safeProjectName = escapeEmailHtml(data.projectName);
  const safeLotNumber = escapeEmailHtml(data.lotNumber);
  const safeRequestedBy = escapeEmailHtml(data.requestedBy);
  const safeScheduledDate = data.scheduledDate ? escapeEmailHtml(data.scheduledDate) : '';
  const safeScheduledTime = data.scheduledTime ? escapeEmailHtml(data.scheduledTime) : '';
  const safeReleaseUrl = escapeEmailHtml(data.releaseUrl);
  const safeNoticeHours =
    typeof data.noticeHours === 'number' ? escapeEmailHtml(String(data.noticeHours)) : '';

  const scheduledInfo = data.scheduledDate
    ? `<strong>Scheduled:</strong> ${safeScheduledDate}${safeScheduledTime ? ` at ${safeScheduledTime}` : ''}`
    : '<strong>Scheduled:</strong> As soon as possible';

  const holdPointRows = data.holdPoints
    .map((holdPoint, index) => {
      const safeDescription = escapeEmailHtml(holdPoint.description);
      const safeSecureReleaseUrl = escapeEmailHtml(holdPoint.secureReleaseUrl);
      const safeEvidencePackageUrl = holdPoint.evidencePackageUrl
        ? escapeEmailHtml(holdPoint.evidencePackageUrl)
        : '';
      const itemLabel = holdPoint.sequenceNumber
        ? `${escapeEmailHtml(String(holdPoint.sequenceNumber))}.`
        : `${index + 1}.`;

      return `
        <li style="margin: 0 0 18px 0; padding-bottom: 18px; border-bottom: 1px solid #e5e7eb;">
          <div style="font-weight: 600; margin-bottom: 8px;">${itemLabel} ${safeDescription}</div>
          <a href="${safeSecureReleaseUrl}" class="button" style="margin-left: 0;">
            Release via Secure Link
          </a>
          ${
            safeEvidencePackageUrl
              ? `<a href="${safeEvidencePackageUrl}" class="button secondary">View Evidence Package</a>`
              : ''
          }
        </li>
      `;
    })
    .join('');

  const textHoldPoints = data.holdPoints
    .map((holdPoint, index) => {
      const itemLabel = holdPoint.sequenceNumber ? `${holdPoint.sequenceNumber}.` : `${index + 1}.`;
      return `${itemLabel} ${holdPoint.description}
Secure release link: ${holdPoint.secureReleaseUrl}${
        holdPoint.evidencePackageUrl ? `\nEvidence package: ${holdPoint.evidencePackageUrl}` : ''
      }`;
    })
    .join('\n\n');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeSubject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 640px; margin: 0 auto; padding: 20px; }
    .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .message-box { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0; }
    .detail-row { padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
    .detail-row:last-child { border-bottom: none; }
    .button { display: inline-block; background: #16a34a; color: white; padding: 12px 18px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px 5px; font-size: 14px; }
    .button.secondary { background: #2563eb; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background: #f3f4f6; border-radius: 0 0 8px 8px; }
    .highlight { background: #fef3c7; padding: 12px; border-radius: 6px; border-left: 4px solid #f59e0b; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Hold Point Release Request</h1>
      <p style="margin: 5px 0 0 0;">${data.holdPoints.length} hold points require review</p>
    </div>
    <div class="content">
      <h2 style="margin-top: 0;">Hi ${safeSuperintendentName},</h2>
      <p>A batch hold point release has been requested on project <strong>${safeProjectName}</strong>.</p>

      <div class="message-box">
        <div class="detail-row"><strong>Lot:</strong> ${safeLotNumber}</div>
        <div class="detail-row">${scheduledInfo}</div>
        <div class="detail-row"><strong>Requested By:</strong> ${safeRequestedBy}</div>
        ${
          safeNoticeHours
            ? `<div class="detail-row"><strong>Notice:</strong> ${safeNoticeHours} hours</div>`
            : ''
        }
      </div>

      <div class="highlight">
        Review each hold point below. Each secure link releases only that individual hold point.
      </div>

      <ol style="padding-left: 22px; margin: 20px 0;">
        ${holdPointRows}
      </ol>

      <p style="color: #6b7280; font-size: 14px;">
        Project lot page: <a href="${safeReleaseUrl}">${safeReleaseUrl}</a>
      </p>
    </div>
    <div class="footer">
      <p>This notification was sent from CIVOS Quality Management System.</p>
      <p>Project: ${safeProjectName}</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Hi ${data.superintendentName},

A batch hold point release has been requested on project ${data.projectName}.

DETAILS
-------
Lot: ${data.lotNumber}
Scheduled: ${data.scheduledDate ? `${data.scheduledDate}${data.scheduledTime ? ` at ${data.scheduledTime}` : ''}` : 'As soon as possible'}
Requested By: ${data.requestedBy}
${typeof data.noticeHours === 'number' ? `Notice: ${data.noticeHours} hours\n` : ''}
HOLD POINTS
-----------
${textHoldPoints}

Project lot page: ${data.releaseUrl}

Each secure link releases only that individual hold point.

---
This notification was sent from CIVOS Quality Management System.
Project: ${data.projectName}
  `;

  return {
    subject,
    html,
    text,
  };
}

export function renderHoldPointReleaseRequestEmail(
  data: HoldPointReleaseRequestTemplateData,
): RenderedHoldPointEmail {
  const subjectLotNumber = sanitizeSupportEmailLine(data.lotNumber, 'Lot');
  const subject = `[CIVOS] Hold Point Release Request - ${subjectLotNumber}`;
  const safeSubject = escapeEmailHtml(subject);
  const safeSuperintendentName = escapeEmailHtml(data.superintendentName);
  const safeProjectName = escapeEmailHtml(data.projectName);
  const safeLotNumber = escapeEmailHtml(data.lotNumber);
  const safeHoldPointDescription = escapeEmailHtml(data.holdPointDescription);
  const safeRequestedBy = escapeEmailHtml(data.requestedBy);
  const safeScheduledDate = data.scheduledDate ? escapeEmailHtml(data.scheduledDate) : '';
  const safeScheduledTime = data.scheduledTime ? escapeEmailHtml(data.scheduledTime) : '';
  const safeNoticeOverrideReason = data.noticeOverrideReason
    ? escapeEmailHtml(data.noticeOverrideReason)
    : '';
  const safeEvidencePackageUrl = data.evidencePackageUrl
    ? escapeEmailHtml(data.evidencePackageUrl)
    : '';
  const safeReleaseUrl = escapeEmailHtml(data.releaseUrl);
  const safeSecureReleaseUrl = data.secureReleaseUrl ? escapeEmailHtml(data.secureReleaseUrl) : '';

  const scheduledInfo = data.scheduledDate
    ? `<strong>Scheduled:</strong> ${safeScheduledDate}${safeScheduledTime ? ` at ${safeScheduledTime}` : ''}`
    : '<strong>Scheduled:</strong> As soon as possible';

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
    .message-box { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0; }
    .detail-row { padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
    .detail-row:last-child { border-bottom: none; }
    .button { display: inline-block; background: #16a34a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px 5px; font-size: 16px; }
    .button.secondary { background: #2563eb; }
    .button:hover { opacity: 0.9; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background: #f3f4f6; border-radius: 0 0 8px 8px; }
    .highlight { background: #fef3c7; padding: 12px; border-radius: 6px; border-left: 4px solid #f59e0b; margin: 15px 0; }
    .urgent { background: #fee2e2; padding: 12px; border-radius: 6px; border-left: 4px solid #dc2626; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚧 Hold Point Release Request</h1>
      <p style="margin: 5px 0 0 0;">Action Required</p>
    </div>
    <div class="content">
      <h2 style="margin-top: 0;">Hi ${safeSuperintendentName},</h2>
      <p>A hold point release has been requested on project <strong>${safeProjectName}</strong>.</p>

      <div class="message-box">
        <div class="detail-row">
          <strong>📍 Lot:</strong> ${safeLotNumber}
        </div>
        <div class="detail-row">
          <strong>🔒 Hold Point:</strong> ${safeHoldPointDescription}
        </div>
        <div class="detail-row">
          ${scheduledInfo}
        </div>
        <div class="detail-row">
          <strong>👤 Requested By:</strong> ${safeRequestedBy}
        </div>
      </div>

      ${
        safeNoticeOverrideReason
          ? `
      <div class="urgent">
        <strong>⚠️ Notice Period Override:</strong><br>
        ${safeNoticeOverrideReason}
      </div>
      `
          : ''
      }

      ${
        safeEvidencePackageUrl
          ? `
      <div class="highlight">
        <strong>📋 Evidence Package Available</strong><br>
        All prerequisite checklist items have been completed. The evidence package is ready for your review.
      </div>
      `
          : ''
      }

      <div style="text-align: center; margin: 25px 0;">
        ${
          safeEvidencePackageUrl
            ? `
        <a href="${safeEvidencePackageUrl}" class="button secondary">
          View Evidence Package
        </a>
        `
            : ''
        }
        <a href="${safeReleaseUrl}" class="button">
          Review & Release Hold Point
        </a>
        ${
          safeSecureReleaseUrl
            ? `
        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">
            Or release without logging in:
          </p>
          <a href="${safeSecureReleaseUrl}" class="button" style="background: #7c3aed;">
            🔐 Release via Secure Link
          </a>
        </div>
        `
            : ''
        }
      </div>

      <p style="color: #6b7280; font-size: 14px;">
        Please review the submission and release the hold point when satisfied, or contact the requestor if additional information is required.
      </p>
    </div>
    <div class="footer">
      <p>This notification was sent from CIVOS Quality Management System.</p>
      <p>Project: ${safeProjectName}</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Hi ${data.superintendentName},

A hold point release has been requested on project ${data.projectName}.

HOLD POINT DETAILS
------------------
Lot: ${data.lotNumber}
Hold Point: ${data.holdPointDescription}
Scheduled: ${data.scheduledDate ? `${data.scheduledDate}${data.scheduledTime ? ` at ${data.scheduledTime}` : ''}` : 'As soon as possible'}
Requested By: ${data.requestedBy}
${data.noticeOverrideReason ? `\nNOTICE PERIOD OVERRIDE: ${data.noticeOverrideReason}\n` : ''}
${
  data.evidencePackageUrl
    ? `
EVIDENCE PACKAGE
----------------
All prerequisite checklist items have been completed.
View evidence package: ${data.evidencePackageUrl}
`
    : ''
}

ACTIONS
-------
Review & Release Hold Point: ${data.releaseUrl}
${data.secureReleaseUrl ? `\nOr release without logging in (secure link):\n${data.secureReleaseUrl}\n` : ''}
Please review the submission and release the hold point when satisfied, or contact the requestor if additional information is required.

---
This notification was sent from CIVOS Quality Management System.
Project: ${data.projectName}
  `;

  return {
    subject,
    html,
    text,
  };
}

export function renderHoldPointChaseEmail(
  data: HoldPointChaseTemplateData,
): RenderedHoldPointEmail {
  const subjectLotNumber = sanitizeSupportEmailLine(data.lotNumber, 'Lot');
  const subject = `[CIVOS] REMINDER: Hold Point Awaiting Release - ${subjectLotNumber} (Chase #${data.chaseCount})`;
  const safeSubject = escapeEmailHtml(subject);
  const safeSuperintendentName = escapeEmailHtml(data.superintendentName);
  const safeProjectName = escapeEmailHtml(data.projectName);
  const safeLotNumber = escapeEmailHtml(data.lotNumber);
  const safeHoldPointDescription = escapeEmailHtml(data.holdPointDescription);
  const safeOriginalRequestDate = escapeEmailHtml(data.originalRequestDate);
  const safeRequestedBy = escapeEmailHtml(data.requestedBy);
  const safeEvidencePackageUrl = data.evidencePackageUrl
    ? escapeEmailHtml(data.evidencePackageUrl)
    : '';
  const safeReleaseUrl = escapeEmailHtml(data.releaseUrl);

  const urgencyMessage =
    data.daysSinceRequest > 5
      ? `<strong style="color: #dc2626;">This hold point has been awaiting release for ${data.daysSinceRequest} days.</strong>`
      : `This hold point has been awaiting release for ${data.daysSinceRequest} days.`;

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
    .header { background: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .message-box { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0; }
    .detail-row { padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
    .detail-row:last-child { border-bottom: none; }
    .button { display: inline-block; background: #16a34a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px 5px; font-size: 16px; }
    .button.secondary { background: #2563eb; }
    .button:hover { opacity: 0.9; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background: #f3f4f6; border-radius: 0 0 8px 8px; }
    .highlight { background: #fef3c7; padding: 12px; border-radius: 6px; border-left: 4px solid #f59e0b; margin: 15px 0; }
    .urgent { background: #fee2e2; padding: 12px; border-radius: 6px; border-left: 4px solid #dc2626; margin: 15px 0; }
    .chase-badge { display: inline-block; background: #f59e0b; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⏰ Hold Point Reminder</h1>
      <p style="margin: 5px 0 0 0;"><span class="chase-badge">Chase #${data.chaseCount}</span></p>
    </div>
    <div class="content">
      <h2 style="margin-top: 0;">Hi ${safeSuperintendentName},</h2>

      <div class="urgent">
        ${urgencyMessage}
      </div>

      <p>This is a reminder about a hold point release request on project <strong>${safeProjectName}</strong> that is still awaiting your action.</p>

      <div class="message-box">
        <div class="detail-row">
          <strong>📍 Lot:</strong> ${safeLotNumber}
        </div>
        <div class="detail-row">
          <strong>🔒 Hold Point:</strong> ${safeHoldPointDescription}
        </div>
        <div class="detail-row">
          <strong>📅 Originally Requested:</strong> ${safeOriginalRequestDate}
        </div>
        <div class="detail-row">
          <strong>👤 Requested By:</strong> ${safeRequestedBy}
        </div>
      </div>

      ${
        safeEvidencePackageUrl
          ? `
      <div class="highlight">
        <strong>📋 Evidence Package Available</strong><br>
        The original evidence package is still available for your review.
      </div>
      `
          : ''
      }

      <div style="text-align: center; margin: 25px 0;">
        ${
          safeEvidencePackageUrl
            ? `
        <a href="${safeEvidencePackageUrl}" class="button secondary">
          View Evidence Package
        </a>
        `
            : ''
        }
        <a href="${safeReleaseUrl}" class="button">
          Review & Release Hold Point
        </a>
      </div>

      <p style="color: #6b7280; font-size: 14px;">
        Please review and release the hold point, or contact the requestor if you require additional information.
      </p>
    </div>
    <div class="footer">
      <p>This is reminder #${data.chaseCount} for this hold point release request.</p>
      <p>Project: ${safeProjectName}</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Hi ${data.superintendentName},

REMINDER: Hold Point Awaiting Release (Chase #${data.chaseCount})

This hold point has been awaiting release for ${data.daysSinceRequest} days.

HOLD POINT DETAILS
------------------
Lot: ${data.lotNumber}
Hold Point: ${data.holdPointDescription}
Originally Requested: ${data.originalRequestDate}
Requested By: ${data.requestedBy}

${
  data.evidencePackageUrl
    ? `
EVIDENCE PACKAGE
----------------
The original evidence package is still available for your review.
View evidence package: ${data.evidencePackageUrl}
`
    : ''
}

ACTIONS
-------
Review & Release Hold Point: ${data.releaseUrl}

Please review and release the hold point, or contact the requestor if you require additional information.

---
This is reminder #${data.chaseCount} for this hold point release request.
Project: ${data.projectName}
  `;

  return {
    subject,
    html,
    text,
  };
}

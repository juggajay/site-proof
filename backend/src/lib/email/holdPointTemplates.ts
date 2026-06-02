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

interface RenderedHoldPointEmail {
  subject: string;
  html: string;
  text: string;
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

export function renderHoldPointReleaseRequestEmail(
  data: HoldPointReleaseRequestTemplateData,
): RenderedHoldPointEmail {
  const subjectLotNumber = sanitizeSupportEmailLine(data.lotNumber, 'Lot');
  const subject = `[SiteProof] Hold Point Release Request - ${subjectLotNumber}`;
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
      <p>This notification was sent from SiteProof Quality Management System.</p>
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
This notification was sent from SiteProof Quality Management System.
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
  const subject = `[SiteProof] REMINDER: Hold Point Awaiting Release - ${subjectLotNumber} (Chase #${data.chaseCount})`;
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

export function renderHoldPointReleaseConfirmationEmail(
  data: HoldPointReleaseConfirmationTemplateData,
): RenderedHoldPointEmail {
  const subjectLotNumber = sanitizeSupportEmailLine(data.lotNumber, 'Lot');
  const subject = `[SiteProof] Hold Point Released - ${subjectLotNumber}`;
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
      <p>This confirmation was sent from SiteProof Quality Management System.</p>
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
This confirmation was sent from SiteProof Quality Management System.
Project: ${data.projectName}
  `;

  return {
    subject,
    html,
    text,
  };
}

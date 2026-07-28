/**
 * Wave E2 — the consolidated reminder digest (spec §4.2.6, `[ER-A3]`, AT-116).
 *
 * The control this exists for: a per-ITEM chase counter is bookkeeping, not a
 * mail-safety control. Three chases across 100 hold points is 300 automated
 * messages to one external superintendent, and the risk being managed is not
 * "one super is annoyed" — it is CIVOS mail being marked as spam and the whole
 * passwordless channel dying with it. The digest is what turns N messages into
 * one per project per recipient per pass; each item keeps its own link, its own
 * token and its own reservation.
 *
 * N = 1 delegates to the shipped single-item chase template UNCHANGED, so the
 * manual chase route's email is byte-identical before and after the extraction
 * (AT-100 characterization).
 */

import { renderHoldPointChaseEmail } from './holdPointTemplates.js';
import type { RenderedHoldPointEmail } from './holdPointTemplateUtils.js';
import { escapeEmailHtml, sanitizeSupportEmailLine } from './holdPointTemplateUtils.js';

export interface HoldPointChaseDigestItem {
  lotNumber: string;
  holdPointDescription: string;
  originalRequestDate: string;
  daysSinceRequest: number;
  chaseCount: number;
  releaseUrl: string;
  evidencePackageUrl?: string;
}

export interface HoldPointChaseDigestTemplateData {
  superintendentName: string;
  projectName: string;
  requestedBy: string;
  /**
   * True when the original requester could not be resolved and the company
   * support address is standing in. The body must SAY so — attributing the
   * request to support would be `[E-B8b]`'s forbidden false attribution.
   */
  requesterIsFallback: boolean;
  holdPoints: HoldPointChaseDigestItem[];
}

function requesterLine(data: HoldPointChaseDigestTemplateData): string {
  return data.requesterIsFallback
    ? `${data.requestedBy} — the original requester is no longer available on this project, so replies go to CIVOS support.`
    : data.requestedBy;
}

export function renderHoldPointChaseDigestEmail(
  data: HoldPointChaseDigestTemplateData,
): RenderedHoldPointEmail {
  const items = data.holdPoints;
  if (items.length === 0) {
    throw new Error('renderHoldPointChaseDigestEmail requires at least one hold point');
  }

  if (items.length === 1) {
    const item = items[0]!;
    return renderHoldPointChaseEmail({
      superintendentName: data.superintendentName,
      projectName: data.projectName,
      lotNumber: item.lotNumber,
      holdPointDescription: item.holdPointDescription,
      originalRequestDate: item.originalRequestDate,
      chaseCount: item.chaseCount,
      daysSinceRequest: item.daysSinceRequest,
      evidencePackageUrl: item.evidencePackageUrl,
      releaseUrl: item.releaseUrl,
      requestedBy: requesterLine(data),
    });
  }

  const safeProjectName = escapeEmailHtml(data.projectName);
  const safeSuperintendentName = escapeEmailHtml(data.superintendentName);
  const safeRequestedBy = escapeEmailHtml(requesterLine(data));
  const subject = `[CIVOS] REMINDER: ${items.length} Hold Points Awaiting Release - ${sanitizeSupportEmailLine(data.projectName, 'Project')}`;
  const oldest = Math.max(...items.map((item) => item.daysSinceRequest));

  const htmlItems = items
    .map((item) => {
      const safeLotNumber = escapeEmailHtml(item.lotNumber);
      const safeDescription = escapeEmailHtml(item.holdPointDescription);
      const safeRequestDate = escapeEmailHtml(item.originalRequestDate);
      const safeReleaseUrl = escapeEmailHtml(item.releaseUrl);
      const safeEvidenceUrl = item.evidencePackageUrl
        ? escapeEmailHtml(item.evidencePackageUrl)
        : '';
      return `
      <div class="message-box">
        <div class="detail-row"><strong>📍 Lot:</strong> ${safeLotNumber}</div>
        <div class="detail-row"><strong>🔒 Hold Point:</strong> ${safeDescription}</div>
        <div class="detail-row"><strong>📅 Originally Requested:</strong> ${safeRequestDate} (${item.daysSinceRequest} days ago)</div>
        <div style="text-align: center; margin: 15px 0 5px 0;">
          ${safeEvidenceUrl ? `<a href="${safeEvidenceUrl}" class="button secondary">View Evidence Package</a>` : ''}
          <a href="${safeReleaseUrl}" class="button">Review &amp; Release</a>
        </div>
      </div>`;
    })
    .join('\n');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeEmailHtml(subject)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .message-box { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0; }
    .detail-row { padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
    .detail-row:last-child { border-bottom: none; }
    .button { display: inline-block; background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 6px 4px; font-size: 15px; }
    .button.secondary { background: #2563eb; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background: #f3f4f6; border-radius: 0 0 8px 8px; }
    .urgent { background: #fee2e2; padding: 12px; border-radius: 6px; border-left: 4px solid #dc2626; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⏰ Hold Point Reminder</h1>
      <p style="margin: 5px 0 0 0;">${items.length} hold points awaiting your release</p>
    </div>
    <div class="content">
      <h2 style="margin-top: 0;">Hi ${safeSuperintendentName},</h2>

      <div class="urgent">
        <strong>${items.length} hold points</strong> on project <strong>${safeProjectName}</strong> are still awaiting your action. The oldest has been waiting ${oldest} days.
      </div>

      <p><strong>👤 Requested By:</strong> ${safeRequestedBy}</p>

      ${htmlItems}

      <p style="color: #6b7280; font-size: 14px;">
        Please review and release each hold point, or reply to this email if you require additional information.
      </p>
    </div>
    <div class="footer">
      <p>This is an automated reminder from CIVOS. Project: ${safeProjectName}</p>
    </div>
  </div>
</body>
</html>
  `;

  const textItems = items
    .map(
      (item) => `
Lot: ${item.lotNumber}
Hold Point: ${item.holdPointDescription}
Originally Requested: ${item.originalRequestDate} (${item.daysSinceRequest} days ago)
Review & Release: ${item.releaseUrl}${
        item.evidencePackageUrl ? `\nView evidence package: ${item.evidencePackageUrl}` : ''
      }`,
    )
    .join('\n');

  const text = `
Hi ${data.superintendentName},

REMINDER: ${items.length} hold points awaiting release on ${data.projectName}.
The oldest has been waiting ${oldest} days.

Requested By: ${requesterLine(data)}

HOLD POINTS
-----------${textItems}

Please review and release each hold point, or reply to this email if you require additional information.

---
This is an automated reminder from CIVOS. Project: ${data.projectName}
  `;

  return { subject, html, text };
}

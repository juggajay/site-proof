/**
 * Wave E2.1 — the public unsubscribe door for hold-point chase reminders.
 *
 * No auth, no account, no session: the recipient is an external superintendent
 * who has never had a CIVOS login, which is exactly why
 * `NotificationEmailPreference` (keyed on `userId`, hard FK to `User`) could
 * never express this and E.0 §7.2 recorded "no unsubscribe of any kind".
 *
 * GET renders a confirmation page and writes NOTHING. POST performs it. That
 * split is not ceremony — Outlook Safe Links, Proofpoint URL Defense and every
 * other mail scanner GETs each link in each message it inspects, so a GET that
 * unsubscribed would silently opt out recipients who never clicked anything,
 * and the chase would go quiet with nobody able to explain why. It is also the
 * shape RFC 8058 one-click expects, so the `List-Unsubscribe-Post` header on
 * the digest points at the POST and works without a second implementation.
 */

import { Router, Request, Response } from 'express';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { escapeEmailHtml } from '../../lib/email/holdPointTemplateUtils.js';
import {
  parseHoldPointUnsubscribeToken,
  recordHoldPointMailUnsubscribe,
} from '../../lib/holdPointMailConsent.js';
import { MAX_RELEASE_TOKEN_LENGTH, parseHoldPointRouteParam } from './validation.js';

export const holdPointUnsubscribeRouter = Router();

const UNSUBSCRIBE_PATH = '/public/unsubscribe/:token';

function renderPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeEmailHtml(title)} — CIVOS</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; background: #f9fafb; margin: 0; padding: 40px 20px; }
    .card { max-width: 520px; margin: 0 auto; background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 32px; }
    h1 { font-size: 20px; margin: 0 0 16px 0; }
    button { background: #dc2626; color: white; border: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 15px; cursor: pointer; }
    .muted { color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${escapeEmailHtml(title)}</h1>
    ${body}
  </div>
</body>
</html>`;
}

function parseTokenOrThrow(req: Request): { projectId: string; email: string } {
  const raw = parseHoldPointRouteParam(req.params.token, 'token', MAX_RELEASE_TOKEN_LENGTH);
  const parsed = parseHoldPointUnsubscribeToken(raw);
  if (!parsed) {
    throw AppError.badRequest('This unsubscribe link is not valid.');
  }
  return parsed;
}

// Confirmation page. Pure: re-reads nothing, writes nothing.
holdPointUnsubscribeRouter.get(
  UNSUBSCRIBE_PATH,
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = parseTokenOrThrow(req);

    res.type('html').send(
      renderPage(
        'Stop hold-point reminder emails?',
        `<p>Confirm and CIVOS will stop sending automated hold-point release reminders to
        <strong>${escapeEmailHtml(email)}</strong>.</p>
        <form method="POST">
          <button type="submit">Unsubscribe me</button>
        </form>
        <p class="muted">This does not affect emails a person sends you directly.</p>`,
      ),
    );
  }),
);

// The act itself. Idempotent — a second POST is a no-op that renders the same page.
holdPointUnsubscribeRouter.post(
  UNSUBSCRIBE_PATH,
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId, email } = parseTokenOrThrow(req);

    await recordHoldPointMailUnsubscribe(projectId, email);

    res.type('html').send(
      renderPage(
        'Unsubscribed',
        `<p>CIVOS will no longer send automated hold-point release reminders to
        <strong>${escapeEmailHtml(email)}</strong>.</p>
        <p class="muted">You can close this page.</p>`,
      ),
    );
  }),
);

import { describe, expect, it } from 'vitest';
import {
  buildHoldPointChaseEmail,
  selectHoldPointChaseRecipients,
  type HoldPointChaseContext,
  type HoldPointChaseRecipient,
} from './chaseNotifications.js';

/**
 * Characterizes the pure hold-point chase email helpers extracted verbatim from
 * backend/src/routes/holdpoints.ts (the POST /:id/chase handler). These freeze
 * the "superintendents win, else project managers" recipient rule and the
 * payload fallbacks ('Superintendent', 'Hold Point', `chaseCount || 1`,
 * requestedBy -> 'Site Team'). All inputs are plain fixtures — no database.
 */

type Recipient = { user: { id: string; email: string; fullName: string | null } };

const sup1: Recipient = { user: { id: 's1', email: 'sup1@example.com', fullName: 'Sue Super' } };
const sup2: Recipient = { user: { id: 's2', email: 'sup2@example.com', fullName: 'Sam Super' } };
const pm1: Recipient = { user: { id: 'p1', email: 'pm1@example.com', fullName: 'Pat PM' } };
const pm2: Recipient = { user: { id: 'p2', email: 'pm2@example.com', fullName: 'Pip PM' } };

const baseContext: HoldPointChaseContext = {
  projectName: 'Riverside Upgrade',
  lotNumber: 'LOT-7',
  holdPointDescription: 'Footing inspection',
  originalRequestDate: 'Monday, 1 June 2026',
  chaseCount: 3,
  daysSinceRequest: 5,
  evidencePackageUrl: 'https://app.example.com/evidence',
  releaseUrl: 'https://app.example.com/release',
  // Wave E2 §4.2.6: this was `notificationSentTo` — the RECIPIENT list — so the
  // chase email told the superintendent the request came from their own
  // address. It is now the requester resolved from the audit log.
  requestedBy: 'Rita Requester',
};

describe('selectHoldPointChaseRecipients', () => {
  it('uses superintendents when any are present (they win over project managers)', () => {
    expect(selectHoldPointChaseRecipients([sup1, sup2], [pm1, pm2])).toEqual([sup1, sup2]);
  });

  it('uses project managers only when there are no superintendents', () => {
    expect(selectHoldPointChaseRecipients([], [pm1, pm2])).toEqual([pm1, pm2]);
  });

  it('returns an empty list when neither group has members', () => {
    expect(selectHoldPointChaseRecipients([], [])).toEqual([]);
  });
});

describe('buildHoldPointChaseEmail', () => {
  it('builds the full chase payload, preserving context values verbatim', () => {
    const recipient: HoldPointChaseRecipient = {
      user: { email: 'sup1@example.com', fullName: 'Sue Super' },
    };

    expect(buildHoldPointChaseEmail(recipient, baseContext)).toEqual({
      to: 'sup1@example.com',
      superintendentName: 'Sue Super',
      projectName: 'Riverside Upgrade',
      lotNumber: 'LOT-7',
      holdPointDescription: 'Footing inspection',
      originalRequestDate: 'Monday, 1 June 2026',
      chaseCount: 3,
      daysSinceRequest: 5,
      evidencePackageUrl: 'https://app.example.com/evidence',
      releaseUrl: 'https://app.example.com/release',
      requestedBy: 'Rita Requester',
    });
  });

  it('never attributes the request to the recipient (`[E-B8b]`, Wave E2)', () => {
    // The pre-E2 defect, pinned as a regression: `requestedBy` came from
    // `notificationSentTo`, so a superintendent was told they had asked
    // themselves. The context no longer carries the recipient list at all.
    const recipient: HoldPointChaseRecipient = {
      user: { email: 'sup1@example.com', fullName: 'Sue Super' },
    };
    const payload = buildHoldPointChaseEmail(recipient, baseContext);

    expect(payload.requestedBy).not.toBe(payload.to);
    expect(payload.requestedBy).toBe('Rita Requester');
    expect(Object.keys(baseContext)).not.toContain('notificationSentTo');
  });

  it('falls back to "Superintendent" when the recipient has no full name', () => {
    const recipient: HoldPointChaseRecipient = {
      user: { email: 'x@example.com', fullName: null },
    };
    expect(buildHoldPointChaseEmail(recipient, baseContext).superintendentName).toBe(
      'Superintendent',
    );
  });

  it('applies the "Hold Point", chaseCount || 1, and "Site Team" fallbacks', () => {
    const recipient: HoldPointChaseRecipient = {
      user: { email: 'x@example.com', fullName: 'Zoe' },
    };
    const payload = buildHoldPointChaseEmail(recipient, {
      ...baseContext,
      holdPointDescription: null,
      chaseCount: 0,
      requestedBy: '',
    });

    expect(payload.holdPointDescription).toBe('Hold Point');
    expect(payload.chaseCount).toBe(1);
    expect(payload.requestedBy).toBe('Site Team');
  });

  it('produces one payload per selected recipient', () => {
    const recipients = selectHoldPointChaseRecipients([], [pm1, pm2]);
    const payloads = recipients.map((r) => buildHoldPointChaseEmail(r, baseContext));

    expect(payloads.map((p) => p.to)).toEqual(['pm1@example.com', 'pm2@example.com']);
    expect(payloads.map((p) => p.superintendentName)).toEqual(['Pat PM', 'Pip PM']);
  });
});

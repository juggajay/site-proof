import { describe, expect, it } from 'vitest';
import {
  renderHoldPointBatchReleaseRequestEmail,
  renderHoldPointReleaseConfirmationEmail,
} from './holdPointTemplates.js';

describe('hold point email templates', () => {
  it('renders a brand-neutral batch request with exactly one secure review link', () => {
    const rendered = renderHoldPointBatchReleaseRequestEmail({
      superintendentName: 'Alex Superintendent',
      projectName: 'Pacific Highway Upgrade',
      lotNumber: 'LOT-001',
      holdPoints: [
        { sequenceNumber: 1, description: 'Subgrade proof roll' },
        { sequenceNumber: 3, description: 'Base course level check' },
      ],
      scheduledDate: 'Friday, 10 July 2026',
      scheduledTime: '09:30',
      batchReviewUrl: 'https://civos.example/hp-release/batch/abc123',
      requestedBy: 'Casey QA',
      noticeHours: 24,
    });

    expect(rendered.subject).toBe(
      '[CIVOS] Pacific Highway Upgrade: 2 hold points ready for release review — Lot LOT-001',
    );
    // The only secure link is the batch review room (button href + fallback
    // href + fallback text = 3 html occurrences, 1 in the plain text).
    expect(rendered.html.match(/hp-release\/batch\/abc123/g)).toHaveLength(3);
    expect(rendered.html).not.toContain('/hp-release/abc123');
    expect(rendered.text.match(/hp-release\/batch\/abc123/g)).toHaveLength(1);
    // No red/green accents; single blue accent + zinc header.
    expect(rendered.html).not.toContain('#dc2626');
    expect(rendered.html).not.toContain('#16a34a');
    expect(rendered.html).toContain('#18181b');
    expect(rendered.html).toContain('#2563eb');
    // Plain numbered list, no per-hold-point links.
    expect(rendered.text).toContain('1. Subgrade proof roll');
    expect(rendered.text).toContain('3. Base course level check');
    expect(rendered.text).toContain('Requested by: Casey QA');
    expect(rendered.html).toContain('CIVOS');
    // The login-only lot page link is gone.
    expect(rendered.html).not.toContain('/projects/');
    expect(rendered.text).not.toContain('Project lot page');
  });

  it('renders release confirmation through the stable holdPointTemplates export', () => {
    const rendered = renderHoldPointReleaseConfirmationEmail({
      recipientName: 'Alex Superintendent',
      recipientRole: 'superintendent',
      projectName: 'Pacific Highway Upgrade',
      lotNumber: 'LOT-001',
      holdPointDescription: 'Concrete pour release',
      releasedByName: 'Casey QA',
      releasedByOrg: 'SiteProof Civil',
      releaseMethod: 'Email confirmation',
      releaseNotes: 'Evidence accepted',
      releasedAt: '07/06/2026, 9:15 am',
      lotUrl: 'https://site-proof.vercel.app/projects/project-1/lots/lot-1',
    });

    expect(rendered.subject).toBe('[CIVOS] Hold Point Released - LOT-001');
    expect(rendered.html).toContain('Hold Point Released');
    expect(rendered.html).toContain('Concrete pour release');
    expect(rendered.text).toContain('Release Method: Email confirmation');
    expect(rendered.text).toContain('Evidence accepted');
  });
});

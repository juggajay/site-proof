import { describe, expect, it } from 'vitest';
import { renderHoldPointReleaseConfirmationEmail } from './holdPointTemplates.js';

describe('hold point email templates', () => {
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

    expect(rendered.subject).toBe('[SiteProof] Hold Point Released - LOT-001');
    expect(rendered.html).toContain('Hold Point Released');
    expect(rendered.html).toContain('Concrete pour release');
    expect(rendered.text).toContain('Release Method: Email confirmation');
    expect(rendered.text).toContain('Evidence accepted');
  });
});

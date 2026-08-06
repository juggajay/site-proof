import { describe, expect, it } from 'vitest';

import { resolveQrReleaseLinkRecipient } from './releaseLinkRecipient.js';

describe('resolveQrReleaseLinkRecipient', () => {
  it('uses the newest live token so the QR releases as the invited authority', () => {
    expect(
      resolveQrReleaseLinkRecipient(
        [
          { recipientEmail: 'newest@example.com', recipientName: 'Amos Soo' },
          { recipientEmail: 'older@example.com', recipientName: 'Older Super' },
        ],
        ['notified@example.com'],
      ),
    ).toEqual({ email: 'newest@example.com', name: 'Amos Soo' });
  });

  it('falls back to the notified address when every token has expired', () => {
    expect(resolveQrReleaseLinkRecipient([], ['super@example.com', 'cc@example.com'])).toEqual({
      email: 'super@example.com',
      name: null,
    });
  });

  it('returns null when no authority is on record, so no link can be minted', () => {
    expect(resolveQrReleaseLinkRecipient([], [])).toBeNull();
  });

  it('trims stored values and treats a blank recipient name as absent', () => {
    expect(
      resolveQrReleaseLinkRecipient(
        [{ recipientEmail: ' super@example.com ', recipientName: '  ' }],
        [],
      ),
    ).toEqual({ email: 'super@example.com', name: null });
  });

  it('skips a token with a blank email rather than minting a link to nobody', () => {
    expect(
      resolveQrReleaseLinkRecipient(
        [
          { recipientEmail: '   ', recipientName: 'Blank' },
          { recipientEmail: 'real@example.com', recipientName: null },
        ],
        [],
      ),
    ).toEqual({ email: 'real@example.com', name: null });
  });
});

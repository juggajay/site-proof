// Benchmark T2 — who a QR release link releases as.
//
// The public release page locks `releasedByName` to the token's
// `recipientName`, so a minted QR link must carry the SAME identity the release
// request was addressed to. Preference order:
//   1. the newest live (unused, unexpired) token for this hold point — the
//      identity the authority was actually emailed;
//   2. the first address on the hold point's `notificationSentTo` list, for a
//      request whose tokens have since expired or been swept by retention.
// If neither exists there is no authority on record and no link is minted.

export interface ReleaseLinkTokenRow {
  recipientEmail: string;
  recipientName: string | null;
}

export interface QrReleaseLinkRecipient {
  email: string;
  name: string | null;
}

export function resolveQrReleaseLinkRecipient(
  /** Live tokens for this hold point, newest first. */
  liveTokens: ReleaseLinkTokenRow[],
  /** Parsed, validated addresses from `HoldPoint.notificationSentTo`. */
  notifiedEmails: string[],
): QrReleaseLinkRecipient | null {
  const newestLiveToken = liveTokens.find((token) => Boolean(token.recipientEmail?.trim()));
  if (newestLiveToken) {
    return {
      email: newestLiveToken.recipientEmail.trim(),
      name: newestLiveToken.recipientName?.trim() || null,
    };
  }

  const fallbackEmail = notifiedEmails.find((email) => Boolean(email?.trim()));
  if (fallbackEmail) {
    return { email: fallbackEmail.trim(), name: null };
  }

  return null;
}

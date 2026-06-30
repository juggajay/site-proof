import { getAuthToken } from './auth';
import { apiUrl } from './config';
import { fetchWithTimeout } from './fetchWithTimeout';

/**
 * Best-effort cookie consent audit write for authenticated browser sessions.
 * Local banner dismissal must not depend on this request succeeding.
 */
export async function recordCookiePolicyConsentDecision(granted: boolean): Promise<void> {
  const token = getAuthToken();
  if (!token) {
    return;
  }

  try {
    await fetchWithTimeout(apiUrl('/api/consent'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        consentType: 'cookie_policy',
        granted,
      }),
    });
  } catch {
    // Consent has already been stored locally. Backend audit failures should
    // never trap the user behind the banner or expire their session.
  }
}

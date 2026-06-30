import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  readLocalStorageItem,
  removeLocalStorageItem,
  writeLocalStorageItem,
} from '@/lib/storagePreferences';

const mocks = vi.hoisted(() => ({
  user: null as { id: string; email: string } | null,
  recordCookiePolicyConsentDecision: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock('@/lib/consentAudit', () => ({
  recordCookiePolicyConsentDecision: mocks.recordCookiePolicyConsentDecision,
}));

import { CookieConsentBanner } from './CookieConsentBanner';

function renderBanner() {
  return render(
    <MemoryRouter>
      <CookieConsentBanner />
    </MemoryRouter>,
  );
}

function readStoredConsent() {
  return JSON.parse(readLocalStorageItem('cookie_consent') ?? 'null') as {
    version: string;
    accepted: boolean;
    timestamp: string;
  } | null;
}

beforeEach(() => {
  removeLocalStorageItem('cookie_consent');
  vi.clearAllMocks();
  mocks.user = null;
  mocks.recordCookiePolicyConsentDecision.mockResolvedValue(undefined);
});

describe('CookieConsentBanner', () => {
  it('stores accepted consent locally and dismisses immediately for logged-out users', async () => {
    const user = userEvent.setup();
    renderBanner();

    await screen.findByTestId('cookie-consent-banner');
    await user.click(screen.getByTestId('cookie-accept-button'));

    await waitFor(() => {
      expect(screen.queryByTestId('cookie-consent-banner')).not.toBeInTheDocument();
    });
    expect(readStoredConsent()).toMatchObject({ version: 'v1', accepted: true });
    expect(mocks.recordCookiePolicyConsentDecision).not.toHaveBeenCalled();
  });

  it('stores declined consent locally and records an authenticated audit decision', async () => {
    const user = userEvent.setup();
    mocks.user = { id: 'user-1', email: 'user@example.com' };

    renderBanner();

    await screen.findByTestId('cookie-consent-banner');
    await user.click(screen.getByTestId('cookie-reject-button'));

    await waitFor(() => {
      expect(screen.queryByTestId('cookie-consent-banner')).not.toBeInTheDocument();
    });
    expect(readStoredConsent()).toMatchObject({ version: 'v1', accepted: false });
    expect(mocks.recordCookiePolicyConsentDecision).toHaveBeenCalledWith(false);
  });

  it('does not render when current-version consent already exists', async () => {
    writeLocalStorageItem(
      'cookie_consent',
      JSON.stringify({
        version: 'v1',
        accepted: true,
        timestamp: new Date().toISOString(),
      }),
    );

    renderBanner();

    await waitFor(() => {
      expect(screen.queryByTestId('cookie-consent-banner')).not.toBeInTheDocument();
    });
  });
});

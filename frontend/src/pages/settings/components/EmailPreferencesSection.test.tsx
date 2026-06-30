import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmailPreferencesSection } from './EmailPreferencesSection';
import { normalizeEmailPreferences } from '../emailPreferencesData';

const useEmailPreferencesMock = vi.hoisted(() => vi.fn());

vi.mock('../useEmailPreferences', () => ({
  useEmailPreferences: useEmailPreferencesMock,
}));

describe('EmailPreferencesSection', () => {
  it('disables individual controls when email notifications are disabled', () => {
    useEmailPreferencesMock.mockReturnValue({
      preferences: normalizeEmailPreferences({
        enabled: false,
        mentions: true,
        mentionsTiming: 'digest',
        dailyDigest: true,
      }),
      isLoading: false,
      loadFailed: false,
      isSaving: false,
      isSendingTestEmail: false,
      message: null,
      reloadPreferences: vi.fn(),
      togglePreference: vi.fn(),
      changePreferenceTiming: vi.fn(),
      sendTestEmail: vi.fn(),
    });

    render(<EmailPreferencesSection />);

    expect(screen.getByRole('button', { name: /send test email/i })).toBeDisabled();
    expect(screen.getByRole('switch', { name: /mentions email notifications/i })).toBeDisabled();
    expect(screen.getByLabelText(/mentions notification timing/i)).toBeDisabled();
  });
});

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EMAIL_PREFERENCES,
  EMAIL_PREFERENCES_PATH,
  SEND_TEST_EMAIL_PATH,
  applyEmailPreferenceTiming,
  applyEmailPreferenceToggle,
  buildSaveEmailPreferencesBody,
  normalizeEmailPreferences,
  type EmailPreferences,
} from './emailPreferencesData';

describe('email preferences data helpers', () => {
  describe('normalizeEmailPreferences (default merge)', () => {
    it('returns a full default preference set for null', () => {
      expect(normalizeEmailPreferences(null)).toEqual(DEFAULT_EMAIL_PREFERENCES);
    });

    it('returns a full default preference set for undefined', () => {
      expect(normalizeEmailPreferences(undefined)).toEqual(DEFAULT_EMAIL_PREFERENCES);
    });

    it('returns a full default preference set for an empty object', () => {
      expect(normalizeEmailPreferences({})).toEqual(DEFAULT_EMAIL_PREFERENCES);
    });

    it('layers a partial server response over the defaults', () => {
      const result = normalizeEmailPreferences({ enabled: false, dailyDigest: true });

      expect(result.enabled).toBe(false);
      expect(result.dailyDigest).toBe(true);
      // Untouched keys fall back to their documented defaults.
      expect(result.mentions).toBe(true);
      expect(result.ncrStatusChangeTiming).toBe('immediate');
    });

    it('lets explicit server values override the defaults', () => {
      const result = normalizeEmailPreferences({ ncrStatusChangeTiming: 'immediate' });

      expect(result.ncrStatusChangeTiming).toBe('immediate');
    });

    it('does not mutate the shared defaults object', () => {
      normalizeEmailPreferences({ enabled: false });

      expect(DEFAULT_EMAIL_PREFERENCES.enabled).toBe(true);
    });
  });

  describe('applyEmailPreferenceToggle (request shaping)', () => {
    it('flips the master enabled flag', () => {
      const result = applyEmailPreferenceToggle(DEFAULT_EMAIL_PREFERENCES, 'enabled');

      expect(result.enabled).toBe(false);
    });

    it('flips an individual notification flag', () => {
      const allOff = normalizeEmailPreferences({ mentions: false });

      expect(applyEmailPreferenceToggle(allOff, 'mentions').mentions).toBe(true);
    });

    it('returns a new object and leaves the source preferences untouched', () => {
      const source = { ...DEFAULT_EMAIL_PREFERENCES };
      const result = applyEmailPreferenceToggle(source, 'mentions');

      expect(result).not.toBe(source);
      expect(source.mentions).toBe(true);
    });

    it('leaves every other preference unchanged', () => {
      const result = applyEmailPreferenceToggle(DEFAULT_EMAIL_PREFERENCES, 'mentions');
      const { mentions: _resultMentions, ...resultRest } = result;
      const { mentions: _defaultMentions, ...defaultRest } = DEFAULT_EMAIL_PREFERENCES;

      expect(resultRest).toEqual(defaultRest);
    });
  });

  describe('applyEmailPreferenceTiming (request shaping)', () => {
    it('sets the timing for a single notification type', () => {
      const result = applyEmailPreferenceTiming(
        DEFAULT_EMAIL_PREFERENCES,
        'scheduledReportsTiming',
        'digest',
      );

      expect(result.scheduledReportsTiming).toBe('digest');
    });

    it('returns a new object and leaves the source preferences untouched', () => {
      const source = { ...DEFAULT_EMAIL_PREFERENCES };
      const result = applyEmailPreferenceTiming(source, 'mentionsTiming', 'digest');

      expect(result).not.toBe(source);
      expect(source.mentionsTiming).toBe('immediate');
    });

    it('leaves every other preference unchanged', () => {
      const result = applyEmailPreferenceTiming(
        DEFAULT_EMAIL_PREFERENCES,
        'mentionsTiming',
        'digest',
      );
      const { mentionsTiming: _resultTiming, ...resultRest } = result;
      const { mentionsTiming: _defaultTiming, ...defaultRest } = DEFAULT_EMAIL_PREFERENCES;

      expect(resultRest).toEqual(defaultRest);
    });
  });

  describe('buildSaveEmailPreferencesBody (request shaping)', () => {
    it('wraps the preferences under a preferences key for the PUT payload', () => {
      const preferences: EmailPreferences = normalizeEmailPreferences({ enabled: false });

      expect(buildSaveEmailPreferencesBody(preferences)).toEqual({ preferences });
    });
  });

  describe('API paths', () => {
    it('targets the notifications email-preferences endpoint', () => {
      expect(EMAIL_PREFERENCES_PATH).toBe('/api/notifications/email-preferences');
    });

    it('targets the send-test-email endpoint', () => {
      expect(SEND_TEST_EMAIL_PATH).toBe('/api/notifications/send-test-email');
    });
  });
});

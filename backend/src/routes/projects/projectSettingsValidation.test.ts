import { describe, expect, it } from 'vitest';
import { parseOptionalProjectSettings } from './projectSettingsValidation.js';

describe('parseOptionalProjectSettings', () => {
  it('accepts the project settings shapes written by the settings UI', () => {
    expect(
      parseOptionalProjectSettings({
        hpRecipients: [{ role: 'Superintendent', email: 'super@example.com' }],
        hpApprovalRequirement: 'superintendent',
        hpMinimumNoticeDays: 5,
        holdPointMinimumNoticeDays: 3,
        requireSubcontractorVerification: true,
        enabledModules: {
          costTracking: true,
          progressClaims: false,
          subcontractors: true,
          dockets: true,
          dailyDiary: false,
        },
        notificationPreferences: {
          holdPointReleases: true,
          ncrAssignments: false,
          testResults: true,
          dailyDiaryReminders: false,
        },
        witnessPointNotifications: {
          enabled: true,
          trigger: 'previous_item',
          clientEmail: 'client@example.com',
          clientName: 'Client Rep',
        },
        witnessPointNotificationEnabled: false,
        witnessPointNotificationTrigger: '2_items_before',
        witnessPointClientEmail: '',
        witnessPointClientName: 'Legacy Client',
      }),
    ).toEqual({
      hpRecipients: [{ role: 'Superintendent', email: 'super@example.com' }],
      hpApprovalRequirement: 'superintendent',
      hpMinimumNoticeDays: 5,
      holdPointMinimumNoticeDays: 3,
      requireSubcontractorVerification: true,
      enabledModules: {
        costTracking: true,
        progressClaims: false,
        subcontractors: true,
        dockets: true,
        dailyDiary: false,
      },
      notificationPreferences: {
        holdPointReleases: true,
        ncrAssignments: false,
        testResults: true,
        dailyDiaryReminders: false,
      },
      witnessPointNotifications: {
        enabled: true,
        trigger: 'previous_item',
        clientEmail: 'client@example.com',
        clientName: 'Client Rep',
      },
      witnessPointNotificationEnabled: false,
      witnessPointNotificationTrigger: '2_items_before',
      witnessPointClientEmail: '',
      witnessPointClientName: 'Legacy Client',
    });
  });

  it.each([
    ['negative notice', { hpMinimumNoticeDays: -1 }],
    ['unsupported notice', { hpMinimumNoticeDays: 4 }],
    ['decimal notice', { hpMinimumNoticeDays: 1.5 }],
    ['string notice', { hpMinimumNoticeDays: '1' }],
    ['legacy negative notice', { holdPointMinimumNoticeDays: -1 }],
  ])('rejects invalid hold-point notice settings: %s', (_label, settings) => {
    expect(() => parseOptionalProjectSettings(settings)).toThrow(/notice days/i);
  });

  it.each([
    ['enabledModules', { enabledModules: { dockets: 'nope' } }],
    ['notificationPreferences', { notificationPreferences: { holdPointReleases: 'false' } }],
    ['witness enabled', { witnessPointNotifications: { enabled: 'yes' } }],
    ['subcontractor verification', { requireSubcontractorVerification: 'true' }],
  ])('rejects non-boolean settings in %s', (_label, settings) => {
    expect(() => parseOptionalProjectSettings(settings)).toThrow(/boolean/i);
  });

  it.each([
    ['approval requirement', { hpApprovalRequirement: 'client' }],
    ['witness trigger', { witnessPointNotifications: { trigger: 'tomorrow' } }],
    ['legacy witness trigger', { witnessPointNotificationTrigger: 'tomorrow' }],
  ])('rejects unsupported enum values in %s', (_label, settings) => {
    expect(() => parseOptionalProjectSettings(settings)).toThrow(/must be/i);
  });

  it.each([
    ['unknown top-level setting', { randomNestedPolicy: { enabled: true } }],
    ['recipient missing role', { hpRecipients: [{ email: 'super@example.com' }] }],
    ['recipient bad email', { hpRecipients: [{ role: 'Super', email: 'not-email' }] }],
    ['witness bad email', { witnessPointNotifications: { clientEmail: 'not-email' } }],
  ])('rejects malformed project settings: %s', (_label, settings) => {
    expect(() => parseOptionalProjectSettings(settings)).toThrow();
  });
});

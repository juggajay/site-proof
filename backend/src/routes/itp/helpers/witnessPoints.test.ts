import { describe, expect, it } from 'vitest';
import { resolveWitnessPointNotificationSettings, type ProjectSettings } from './witnessPoints.js';

describe('resolveWitnessPointNotificationSettings', () => {
  it('uses the nested witnessPointNotifications object when present', () => {
    const settings: ProjectSettings = {
      witnessPointNotifications: {
        enabled: false,
        trigger: '2_items_before',
        clientEmail: 'super@client.com',
        clientName: 'Jane Super',
      },
    };

    expect(resolveWitnessPointNotificationSettings(settings)).toEqual({
      enabled: false,
      trigger: '2_items_before',
      clientEmail: 'super@client.com',
      clientName: 'Jane Super',
    });
  });

  it('falls back to legacy flat keys when only those are present', () => {
    const settings: ProjectSettings = {
      witnessPointNotificationEnabled: false,
      witnessPointNotificationTrigger: '2_items_before',
      witnessPointClientEmail: 'legacy@client.com',
      witnessPointClientName: 'Legacy Contact',
    };

    expect(resolveWitnessPointNotificationSettings(settings)).toEqual({
      enabled: false,
      trigger: '2_items_before',
      clientEmail: 'legacy@client.com',
      clientName: 'Legacy Contact',
    });
  });

  it('prefers nested values over legacy flat keys when both are present', () => {
    const settings: ProjectSettings = {
      witnessPointNotifications: {
        enabled: true,
        trigger: 'previous_item',
        clientEmail: 'nested@client.com',
        clientName: 'Nested Contact',
      },
      witnessPointNotificationEnabled: false,
      witnessPointNotificationTrigger: '2_items_before',
      witnessPointClientEmail: 'legacy@client.com',
      witnessPointClientName: 'Legacy Contact',
    };

    expect(resolveWitnessPointNotificationSettings(settings)).toEqual({
      enabled: true,
      trigger: 'previous_item',
      clientEmail: 'nested@client.com',
      clientName: 'Nested Contact',
    });
  });

  it('returns historical defaults when no config is present', () => {
    expect(resolveWitnessPointNotificationSettings({})).toEqual({
      enabled: true,
      trigger: 'previous_item',
      clientEmail: null,
      clientName: 'Client Representative',
    });
  });

  it('treats an empty nested client email (UI default) as not configured', () => {
    const settings: ProjectSettings = {
      witnessPointNotifications: {
        enabled: true,
        trigger: 'previous_item',
        clientEmail: '',
        clientName: '',
      },
    };

    const resolved = resolveWitnessPointNotificationSettings(settings);
    expect(resolved.clientEmail).toBeNull();
    expect(resolved.clientName).toBe('Client Representative');
    expect(resolved.enabled).toBe(true);
  });

  it('keeps notifications enabled when nested enabled flag is omitted', () => {
    const settings: ProjectSettings = {
      witnessPointNotifications: {
        trigger: 'previous_item',
        clientEmail: 'super@client.com',
        clientName: 'Jane Super',
      },
    };

    expect(resolveWitnessPointNotificationSettings(settings).enabled).toBe(true);
  });
});

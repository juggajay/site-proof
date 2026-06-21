import { AppError } from '../../lib/AppError.js';

const PROJECT_SETTINGS_MAX_LENGTH = 20000;
const EMAIL_MAX_LENGTH = 254;
const PROJECT_SETTINGS_LABEL_MAX_LENGTH = 160;
const PROJECT_SETTINGS_RECIPIENT_MAX_COUNT = 50;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BOOLEAN_MAP_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const HOLD_POINT_NOTICE_DAYS = new Set([0, 1, 2, 3, 5]);
const HP_APPROVAL_REQUIREMENTS = new Set(['any', 'none', 'superintendent']);
const WITNESS_POINT_TRIGGERS = new Set(['previous_item', '2_items_before', 'same_day']);
const PROJECT_SETTINGS_KEYS = new Set([
  'enabledModules',
  'holdPointMinimumNoticeDays',
  'hpApprovalRequirement',
  'hpMinimumNoticeDays',
  'hpRecipients',
  'notificationPreferences',
  'requireSubcontractorVerification',
  'witnessPointClientEmail',
  'witnessPointClientName',
  'witnessPointNotificationEnabled',
  'witnessPointNotificationTrigger',
  'witnessPointNotifications',
]);
const WITNESS_POINT_NOTIFICATION_KEYS = new Set([
  'clientEmail',
  'clientName',
  'enabled',
  'trigger',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assertAllowedKeys(
  record: Record<string, unknown>,
  allowedKeys: Set<string>,
  label: string,
) {
  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) {
      throw AppError.badRequest(`${label}.${key} is not supported`);
    }
  }
}

function parseBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== 'boolean') {
    throw AppError.badRequest(`${fieldName} must be a boolean`);
  }
  return value;
}

function parseBooleanMap(value: unknown, fieldName: string): Record<string, boolean> {
  if (!isRecord(value)) {
    throw AppError.badRequest(`${fieldName} must be an object`);
  }

  const parsed: Record<string, boolean> = {};
  for (const [key, entryValue] of Object.entries(value)) {
    if (!BOOLEAN_MAP_KEY_PATTERN.test(key)) {
      throw AppError.badRequest(`${fieldName}.${key} is not supported`);
    }
    parsed[key] = parseBoolean(entryValue, `${fieldName}.${key}`);
  }
  return parsed;
}

function parseRequiredString(value: unknown, fieldName: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw AppError.badRequest(`${fieldName} is required`);
  }
  if (trimmed.length > maxLength) {
    throw AppError.badRequest(`${fieldName} must be ${maxLength} characters or less`);
  }
  return trimmed;
}

function parseOptionalString(value: unknown, fieldName: string, maxLength: number): string | null {
  if (value === null) return null;
  if (value === '') return '';
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw AppError.badRequest(`${fieldName} must be ${maxLength} characters or less`);
  }
  return trimmed;
}

function parseEmail(value: unknown, fieldName: string): string {
  const email = parseRequiredString(value, fieldName, EMAIL_MAX_LENGTH).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw AppError.badRequest(`${fieldName} must be a valid email address`);
  }
  return email;
}

function parseOptionalEmail(value: unknown, fieldName: string): string | null {
  if (value === null) return null;
  if (value === '') return '';
  const email = parseRequiredString(value, fieldName, EMAIL_MAX_LENGTH).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw AppError.badRequest(`${fieldName} must be a valid email address`);
  }
  return email;
}

function parseHoldPointNoticeDays(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || !HOLD_POINT_NOTICE_DAYS.has(value)) {
    throw AppError.badRequest(`${fieldName} notice days must be one of 0, 1, 2, 3, or 5`);
  }
  return value;
}

function parseHpApprovalRequirement(value: unknown): string {
  if (typeof value !== 'string' || !HP_APPROVAL_REQUIREMENTS.has(value)) {
    throw AppError.badRequest('hpApprovalRequirement must be any, none, or superintendent');
  }
  return value;
}

function parseWitnessPointTrigger(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !WITNESS_POINT_TRIGGERS.has(value)) {
    throw AppError.badRequest(`${fieldName} must be previous_item, 2_items_before, or same_day`);
  }
  return value;
}

function parseHpRecipients(value: unknown): Array<{ role: string; email: string }> {
  if (!Array.isArray(value)) {
    throw AppError.badRequest('hpRecipients must be an array');
  }
  if (value.length > PROJECT_SETTINGS_RECIPIENT_MAX_COUNT) {
    throw AppError.badRequest(
      `hpRecipients must contain ${PROJECT_SETTINGS_RECIPIENT_MAX_COUNT} recipients or less`,
    );
  }

  return value.map((recipient, index) => {
    if (!isRecord(recipient)) {
      throw AppError.badRequest(`hpRecipients.${index} must be an object`);
    }
    assertAllowedKeys(recipient, new Set(['email', 'role']), `hpRecipients.${index}`);
    return {
      role: parseRequiredString(
        recipient.role,
        `hpRecipients.${index}.role`,
        PROJECT_SETTINGS_LABEL_MAX_LENGTH,
      ),
      email: parseEmail(recipient.email, `hpRecipients.${index}.email`),
    };
  });
}

function parseWitnessPointNotifications(value: unknown): Record<string, string | boolean | null> {
  if (!isRecord(value)) {
    throw AppError.badRequest('witnessPointNotifications must be an object');
  }

  assertAllowedKeys(value, WITNESS_POINT_NOTIFICATION_KEYS, 'witnessPointNotifications');

  const parsed: Record<string, string | boolean | null> = {};
  if ('enabled' in value) {
    parsed.enabled = parseBoolean(value.enabled, 'witnessPointNotifications.enabled');
  }
  if ('trigger' in value) {
    parsed.trigger = parseWitnessPointTrigger(value.trigger, 'witnessPointNotifications.trigger');
  }
  if ('clientEmail' in value) {
    parsed.clientEmail = parseOptionalEmail(
      value.clientEmail,
      'witnessPointNotifications.clientEmail',
    );
  }
  if ('clientName' in value) {
    parsed.clientName = parseOptionalString(
      value.clientName,
      'witnessPointNotifications.clientName',
      PROJECT_SETTINGS_LABEL_MAX_LENGTH,
    );
  }
  return parsed;
}

export function parseOptionalProjectSettings(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw AppError.badRequest('Settings must be an object');
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw AppError.badRequest('Settings must be JSON serializable');
  }
  if (serialized.length > PROJECT_SETTINGS_MAX_LENGTH) {
    throw AppError.badRequest('Settings payload is too large');
  }

  assertAllowedKeys(value, PROJECT_SETTINGS_KEYS, 'settings');

  const parsed: Record<string, unknown> = {};
  for (const [key, entryValue] of Object.entries(value)) {
    switch (key) {
      case 'enabledModules':
      case 'notificationPreferences':
        parsed[key] = parseBooleanMap(entryValue, key);
        break;
      case 'holdPointMinimumNoticeDays':
      case 'hpMinimumNoticeDays':
        parsed[key] = parseHoldPointNoticeDays(entryValue, key);
        break;
      case 'hpApprovalRequirement':
        parsed[key] = parseHpApprovalRequirement(entryValue);
        break;
      case 'hpRecipients':
        parsed[key] = parseHpRecipients(entryValue);
        break;
      case 'requireSubcontractorVerification':
      case 'witnessPointNotificationEnabled':
        parsed[key] = parseBoolean(entryValue, key);
        break;
      case 'witnessPointNotificationTrigger':
        parsed[key] = parseWitnessPointTrigger(entryValue, key);
        break;
      case 'witnessPointClientEmail':
        parsed[key] = parseOptionalEmail(entryValue, key);
        break;
      case 'witnessPointClientName':
        parsed[key] = parseOptionalString(entryValue, key, PROJECT_SETTINGS_LABEL_MAX_LENGTH);
        break;
      case 'witnessPointNotifications':
        parsed[key] = parseWitnessPointNotifications(entryValue);
        break;
    }
  }

  return parsed;
}

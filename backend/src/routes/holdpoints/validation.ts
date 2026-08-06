import { z } from 'zod';

import { AppError } from '../../lib/AppError.js';

// =============================================================================
// Hold point request validation: shared Zod schemas, input limits/format
// constants, route-parameter parsing, and email-list/project-settings helpers.
// Extracted verbatim from holdpoints.ts to keep validation contracts identical
// (behavior-preserving).
// =============================================================================

// Type for project settings related to hold points
export interface HPProjectSettings {
  hpRecipients?: Array<{ email: string }>;
  hpApprovalRequirement?: string;
  hpMinimumNoticeDays?: number;
  holdPointMinimumNoticeDays?: number;
}

export const emailAddressSchema = z.string().trim().email();

export function isValidEmailAddress(email: string): boolean {
  return emailAddressSchema.safeParse(email).success;
}

export function normalizeEmailList(emails: string[]): string[] {
  const seen = new Set<string>();

  return emails
    .map((email) => email.trim())
    .filter(Boolean)
    .filter((email) => {
      const key = email.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

export function parseNotificationEmailList(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  return normalizeEmailList(value.split(/[,\n;]/));
}

export function hasValidNotificationEmailList(value: string | null | undefined): boolean {
  if (!value?.trim()) {
    return true;
  }

  const emails = parseNotificationEmailList(value);
  return emails.length > 0 && emails.every(isValidEmailAddress);
}

export function parseHPDefaultRecipients(settings: HPProjectSettings): string[] {
  if (!Array.isArray(settings.hpRecipients)) {
    return [];
  }

  return normalizeEmailList(
    settings.hpRecipients.map((recipient) => recipient?.email || ''),
  ).filter(isValidEmailAddress);
}

export function parseHPProjectSettings(rawSettings: string | null | undefined): HPProjectSettings {
  if (!rawSettings) {
    return {};
  }

  try {
    return JSON.parse(rawSettings) as HPProjectSettings;
  } catch (_error) {
    return {};
  }
}

export function getHoldPointMinimumNoticeDays(settings: HPProjectSettings): number {
  return settings.hpMinimumNoticeDays ?? settings.holdPointMinimumNoticeDays ?? 1;
}

export function requiresSuperintendentApproval(settings: HPProjectSettings): boolean {
  return settings.hpApprovalRequirement === 'superintendent';
}

// =============================================================================
// Zod Validation Schemas
// =============================================================================

export const MAX_ID_LENGTH = 120;
export const MAX_NAME_LENGTH = 160;
export const MAX_ORG_LENGTH = 160;
export const MAX_NOTE_LENGTH = 5000;
export const MAX_SIGNATURE_DATA_URL_LENGTH = 900_000;
export const MAX_DATE_INPUT_LENGTH = 64;
export const MAX_TIME_INPUT_LENGTH = 5;
export const MAX_RELEASE_TOKEN_LENGTH = 512;
export const MAX_EVIDENCE_DOCUMENT_IDS = 50;
export const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
export const DATE_COMPONENT_RE = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/;
export const TIME_24H_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const BASE64_DATA_RE =
  '(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)';
export const SIGNATURE_IMAGE_DATA_URL_RE = new RegExp(
  `^data:image\\/(?:png|jpe?g|webp);base64,${BASE64_DATA_RE}$`,
  'i',
);
export const RELEASE_METHODS = ['digital', 'email', 'paper'] as const;

export const requiredIdSchema = (fieldName: string) =>
  z
    .string()
    .trim()
    .min(1, `${fieldName} is required`)
    .max(MAX_ID_LENGTH, `${fieldName} is too long`);

export const requiredTrimmedStringSchema = (fieldName: string, maxLength: number) =>
  z.string().trim().min(1, `${fieldName} is required`).max(maxLength, `${fieldName} is too long`);

export const nullableTrimmedStringSchema = (maxLength: number, fieldName: string) =>
  z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    },
    z.string().max(maxLength, `${fieldName} is too long`).nullish(),
  );

export const optionalTrimmedStringSchema = (maxLength: number, fieldName: string) =>
  z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    },
    z.string().max(maxLength, `${fieldName} is too long`).optional(),
  );

export const nullableScheduledTimeSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}, z.string().max(MAX_TIME_INPUT_LENGTH, 'scheduledTime must be in HH:mm format').regex(TIME_24H_RE, 'scheduledTime must be in HH:mm format').nullish());

export const optionalReleaseMethodSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.enum(RELEASE_METHODS).optional());

export const nullableSignatureDataUrlSchema = nullableTrimmedStringSchema(
  MAX_SIGNATURE_DATA_URL_LENGTH,
  'signatureDataUrl',
).refine(
  (value) => value === null || value === undefined || SIGNATURE_IMAGE_DATA_URL_RE.test(value),
  'signatureDataUrl must be a base64 PNG, JPEG, or WebP image data URL',
);

// M20: the public secure-link release page must capture the external reviewer's
// signature, so it is required (unlike the authenticated release, which allows
// email-confirmation releases without a drawn signature).
export const requiredSignatureDataUrlSchema = requiredTrimmedStringSchema(
  'signatureDataUrl',
  MAX_SIGNATURE_DATA_URL_LENGTH,
).refine(
  (value) => SIGNATURE_IMAGE_DATA_URL_RE.test(value),
  'A signature is required to release this hold point.',
);

export const nullableScheduledDateSchema = nullableTrimmedStringSchema(
  MAX_DATE_INPUT_LENGTH,
  'scheduledDate',
);
export const nullableReleaseDateSchema = nullableTrimmedStringSchema(
  MAX_DATE_INPUT_LENGTH,
  'releaseDate',
);
export const nullableReleaseTimeSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}, z.string().max(MAX_TIME_INPUT_LENGTH, 'releaseTime must be in HH:mm format').regex(TIME_24H_RE, 'releaseTime must be in HH:mm format').nullish());

export const requestReleaseSchema = z
  .object({
    lotId: requiredIdSchema('lotId'),
    itpChecklistItemId: requiredIdSchema('itpChecklistItemId'),
    evidenceDocumentIds: z
      .array(requiredIdSchema('evidenceDocumentIds'))
      .max(
        MAX_EVIDENCE_DOCUMENT_IDS,
        `evidenceDocumentIds cannot exceed ${MAX_EVIDENCE_DOCUMENT_IDS} documents`,
      )
      .optional()
      .default([]),
    scheduledDate: nullableScheduledDateSchema,
    scheduledTime: nullableScheduledTimeSchema,
    notificationSentTo: nullableTrimmedStringSchema(MAX_NOTE_LENGTH, 'notificationSentTo').refine(
      hasValidNotificationEmailList,
      'notificationSentTo must contain one or more valid email addresses separated by commas or semicolons',
    ),
    noticePeriodOverride: z.boolean().optional(),
    noticePeriodOverrideReason: nullableTrimmedStringSchema(1000, 'noticePeriodOverrideReason'),
  })
  .superRefine((data, ctx) => {
    if (data.noticePeriodOverride && !data.noticePeriodOverrideReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['noticePeriodOverrideReason'],
        message: 'noticePeriodOverrideReason is required when noticePeriodOverride is true',
      });
    }
  });

export const releaseHoldPointSchema = z.object({
  releasedByName: requiredTrimmedStringSchema('releasedByName', MAX_NAME_LENGTH),
  releasedByOrg: requiredTrimmedStringSchema('releasedByOrg', MAX_ORG_LENGTH),
  releaseDate: nullableReleaseDateSchema,
  releaseTime: nullableReleaseTimeSchema,
  releaseMethod: optionalReleaseMethodSchema,
  releaseNotes: optionalTrimmedStringSchema(MAX_NOTE_LENGTH, 'releaseNotes'),
  signatureDataUrl: nullableSignatureDataUrlSchema,
  releaseEvidenceDocumentId: optionalTrimmedStringSchema(
    MAX_ID_LENGTH,
    'releaseEvidenceDocumentId',
  ),
});

export const escalateSchema = z.object({
  escalatedTo: optionalTrimmedStringSchema(MAX_NAME_LENGTH, 'escalatedTo'),
  escalationReason: optionalTrimmedStringSchema(MAX_NOTE_LENGTH, 'escalationReason'),
});

export const calculateNotificationTimeSchema = z.object({
  projectId: requiredIdSchema('projectId'),
  requestedDateTime: requiredTrimmedStringSchema('requestedDateTime', MAX_DATE_INPUT_LENGTH),
});

export const previewEvidencePackageSchema = z.object({
  lotId: requiredIdSchema('lotId'),
  itpChecklistItemId: requiredIdSchema('itpChecklistItemId'),
});

export const publicReleaseSchema = z.object({
  releasedByName: requiredTrimmedStringSchema('Released by name', MAX_NAME_LENGTH),
  releasedByOrg: optionalTrimmedStringSchema(MAX_ORG_LENGTH, 'releasedByOrg'),
  releaseNotes: optionalTrimmedStringSchema(MAX_NOTE_LENGTH, 'releaseNotes'),
  signatureDataUrl: requiredSignatureDataUrlSchema,
});

export const MAX_BATCH_RELEASE_ITEMS = 25;

// Public batch review-room release: one signed identity releases the selected
// hold points of a batch. Mirrors publicReleaseSchema (signature required) plus
// the list of hold-point ids to release.
export const publicBatchReleaseSchema = z.object({
  holdPointIds: z
    .array(requiredIdSchema('holdPointIds'))
    .min(1, 'At least one hold point is required')
    .max(
      MAX_BATCH_RELEASE_ITEMS,
      `A batch release cannot exceed ${MAX_BATCH_RELEASE_ITEMS} hold points`,
    ),
  releasedByName: requiredTrimmedStringSchema('Released by name', MAX_NAME_LENGTH),
  releasedByOrg: optionalTrimmedStringSchema(MAX_ORG_LENGTH, 'releasedByOrg'),
  releaseNotes: optionalTrimmedStringSchema(MAX_NOTE_LENGTH, 'releaseNotes'),
  signatureDataUrl: requiredSignatureDataUrlSchema,
});

// =============================================================================
// Route parameter parsing
// =============================================================================

// Validate and trim a single hold point route parameter (e.g. :projectId,
// :lotId, :itemId, :id, :token), enforcing the shared length limits before any
// database lookup. Extracted verbatim from holdpoints.ts so both the parent
// router and the read-route child router share one implementation.
export function parseHoldPointRouteParam(
  value: unknown,
  fieldName: string,
  maxLength = MAX_ID_LENGTH,
): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a single value`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw AppError.badRequest(`${fieldName} is required`);
  }

  if (trimmed.length > maxLength) {
    throw AppError.badRequest(`${fieldName} is too long`);
  }

  return trimmed;
}

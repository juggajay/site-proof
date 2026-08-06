import { describe, expect, it } from 'vitest';
import { AppError } from '../../lib/AppError.js';
import {
  getHoldPointMinimumNoticeDays,
  MAX_ID_LENGTH,
  MAX_RELEASE_TOKEN_LENGTH,
  parseHoldPointRouteParam,
  requestReleaseSchema,
  publicReleaseSchema,
  releaseHoldPointSchema,
} from './validation.js';

function captureError(fn: () => unknown): AppError {
  try {
    fn();
  } catch (error) {
    return error as AppError;
  }
  throw new Error('Expected parseHoldPointRouteParam to throw');
}

describe('parseHoldPointRouteParam (pure, DB-free)', () => {
  it('trims and returns a valid route parameter', () => {
    expect(parseHoldPointRouteParam('  lot-123  ', 'lotId')).toBe('lot-123');
    expect(parseHoldPointRouteParam('abc', 'id')).toBe('abc');
  });

  it('rejects non-string values with a 400 "must be a single value"', () => {
    for (const value of [undefined, null, 42, ['a', 'b'], { id: 'x' }]) {
      const error = captureError(() => parseHoldPointRouteParam(value, 'projectId'));
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('projectId must be a single value');
    }
  });

  it('rejects empty or whitespace-only values with a 400 "is required"', () => {
    for (const value of ['', '   ', '\t\n']) {
      const error = captureError(() => parseHoldPointRouteParam(value, 'itemId'));
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('itemId is required');
    }
  });

  it('rejects values longer than the default MAX_ID_LENGTH with a 400 "is too long"', () => {
    const tooLong = 'a'.repeat(MAX_ID_LENGTH + 1);
    const error = captureError(() => parseHoldPointRouteParam(tooLong, 'lotId'));
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('lotId is too long');

    // Exactly at the limit is allowed.
    const atLimit = 'a'.repeat(MAX_ID_LENGTH);
    expect(parseHoldPointRouteParam(atLimit, 'lotId')).toBe(atLimit);
  });

  it('honours a custom maxLength (e.g. the longer release-token bound)', () => {
    const longToken = 't'.repeat(MAX_RELEASE_TOKEN_LENGTH);
    expect(parseHoldPointRouteParam(longToken, 'token', MAX_RELEASE_TOKEN_LENGTH)).toBe(longToken);

    const overToken = 't'.repeat(MAX_RELEASE_TOKEN_LENGTH + 1);
    const error = captureError(() =>
      parseHoldPointRouteParam(overToken, 'token', MAX_RELEASE_TOKEN_LENGTH),
    );
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('token is too long');

    // The token bound is intentionally larger than the default id bound, so the
    // long (valid) token above only passes because the custom maxLength is used.
    expect(longToken.length).toBeGreaterThan(MAX_ID_LENGTH);
  });
});

describe('getHoldPointMinimumNoticeDays (pure, DB-free)', () => {
  it('uses the project-settings UI key before the legacy backend key', () => {
    expect(getHoldPointMinimumNoticeDays({ hpMinimumNoticeDays: 5 })).toBe(5);
    expect(getHoldPointMinimumNoticeDays({ holdPointMinimumNoticeDays: 3 })).toBe(3);
    expect(
      getHoldPointMinimumNoticeDays({
        hpMinimumNoticeDays: 2,
        holdPointMinimumNoticeDays: 5,
      }),
    ).toBe(2);
    expect(getHoldPointMinimumNoticeDays({})).toBe(1);
  });
});

describe('requestReleaseSchema evidence document validation (pure, DB-free)', () => {
  it('accepts and trims hold point request evidence document ids', () => {
    const result = requestReleaseSchema.safeParse({
      lotId: 'lot-1',
      itpChecklistItemId: 'item-1',
      evidenceDocumentIds: [' doc-1 ', 'doc-2'],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.evidenceDocumentIds).toEqual(['doc-1', 'doc-2']);
    }
  });

  it('rejects overlong hold point request evidence document ids', () => {
    const result = requestReleaseSchema.safeParse({
      lotId: 'lot-1',
      itpChecklistItemId: 'item-1',
      evidenceDocumentIds: ['a'.repeat(MAX_ID_LENGTH + 1)],
    });

    expect(result.success).toBe(false);
  });
});

describe('hold point release signature validation (pure, DB-free)', () => {
  const validSignature = 'data:image/png;base64,ZmFrZS1zaWduYXR1cmU=';

  it('accepts browser-generated image signature data URLs', () => {
    expect(
      releaseHoldPointSchema.safeParse({
        releasedByName: 'External Superintendent',
        releasedByOrg: 'Client Company',
        releaseMethod: 'digital',
        signatureDataUrl: validSignature,
      }).success,
    ).toBe(true);

    expect(
      publicReleaseSchema.safeParse({
        releasedByName: 'External Superintendent',
        signatureDataUrl: validSignature,
      }).success,
    ).toBe(true);
  });

  it('rejects non-image or non-data-url signature values', () => {
    const invalidSignatures = [
      'not-a-data-url',
      'https://example.invalid/signature.png',
      'data:text/html;base64,PHNjcmlwdD5hPC9zY3JpcHQ=',
      'data:image/svg+xml;base64,PHN2Zy8+',
      'data:image/png;base64,',
    ];

    for (const signatureDataUrl of invalidSignatures) {
      expect(
        releaseHoldPointSchema.safeParse({
          releasedByName: 'External Superintendent',
          releasedByOrg: 'Client Company',
          signatureDataUrl,
        }).success,
      ).toBe(false);
      expect(
        publicReleaseSchema.safeParse({
          releasedByName: 'External Superintendent',
          signatureDataUrl,
        }).success,
      ).toBe(false);
    }
  });

  it('requires a signature on the public secure-link release (M20)', () => {
    // The public secure-link release page must capture the external reviewer's
    // signature; the schema rejects a release with no signature.
    for (const signatureDataUrl of [undefined, null, '']) {
      expect(
        publicReleaseSchema.safeParse({
          releasedByName: 'External Superintendent',
          signatureDataUrl,
        }).success,
      ).toBe(false);
    }

    expect(
      publicReleaseSchema.safeParse({
        releasedByName: 'External Superintendent',
        signatureDataUrl: validSignature,
      }).success,
    ).toBe(true);

    // The authenticated release keeps the signature optional (e.g. email
    // confirmation releases without a drawn signature).
    expect(
      releaseHoldPointSchema.safeParse({
        releasedByName: 'Internal QM',
        releasedByOrg: 'SiteProof',
      }).success,
    ).toBe(true);
  });
});

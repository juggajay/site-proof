import { describe, expect, it } from 'vitest';
import {
  buildDocumentSignedUrlTokenResponse,
  buildInvalidDocumentSignedUrlTokenResponse,
} from './documentResponses.js';

describe('document response helpers', () => {
  it('builds an invalid signed URL token response', () => {
    expect(buildInvalidDocumentSignedUrlTokenResponse(false)).toEqual({
      valid: false,
      expired: false,
      message: 'Token is invalid',
    });
  });

  it('builds an expired signed URL token response', () => {
    expect(buildInvalidDocumentSignedUrlTokenResponse(true)).toEqual({
      valid: false,
      expired: true,
      message: 'Token has expired',
    });
  });

  it('builds a valid signed URL token response with ISO timestamps', () => {
    expect(
      buildDocumentSignedUrlTokenResponse({
        documentId: 'doc-123',
        expiresAt: new Date('2026-06-01T01:02:03.000Z'),
        createdAt: new Date('2026-06-01T00:02:03.000Z'),
      }),
    ).toEqual({
      valid: true,
      expired: false,
      documentId: 'doc-123',
      expiresAt: '2026-06-01T01:02:03.000Z',
      createdAt: '2026-06-01T00:02:03.000Z',
      message: 'Token is valid',
    });
  });
});

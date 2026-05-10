import { describe, expect, it } from 'vitest';
import { parseAuditLogChanges, sanitizeAuditChanges } from './auditLog.js';

describe('audit log sanitization', () => {
  it('redacts sensitive keys before audit changes are stored', () => {
    expect(
      sanitizeAuditChanges({
        status: { from: 'draft', to: 'active' },
        password: 'new-password',
        tokenInvalidatedAt: '2026-05-08T00:00:00.000Z',
        nested: {
          apiKey: 'sp_secret',
          safe: 'visible',
        },
        array: [{ secret: 'hidden' }, { note: 'visible' }],
      }),
    ).toEqual({
      status: { from: 'draft', to: 'active' },
      password: '[REDACTED]',
      tokenInvalidatedAt: '[REDACTED]',
      nested: {
        apiKey: '[REDACTED]',
        safe: 'visible',
      },
      array: [{ secret: '[REDACTED]' }, { note: 'visible' }],
    });
  });

  it('redacts query values in URL fields while preserving non-secret audit data', () => {
    expect(
      sanitizeAuditChanges({
        fileUrl: 'https://files.example.com/documents/spec.pdf?token=signed-token&download=1',
        callbackUrl: '/api/documents/download/doc-1?token=signed-token',
        note: 'visible',
        nested: {
          previewUrl: 'https://files.example.com/preview.png?signature=secret',
        },
        fileUrls: [
          'https://files.example.com/a.pdf?token=a',
          'data:application/pdf;base64,secret-inline-doc',
        ],
      }),
    ).toEqual({
      fileUrl: 'https://files.example.com/documents/spec.pdf?token=[REDACTED]&download=[REDACTED]',
      callbackUrl: '/api/documents/download/doc-1?token=[REDACTED]',
      note: 'visible',
      nested: {
        previewUrl: 'https://files.example.com/preview.png?signature=[REDACTED]',
      },
      fileUrls: ['https://files.example.com/a.pdf?token=[REDACTED]', '[REDACTED]'],
    });
  });

  it('redacts sensitive legacy audit changes while parsing API responses', () => {
    const parsed = parseAuditLogChanges(
      JSON.stringify({
        email: 'user@example.com',
        keyHash: 'stored-hash',
        credential: 'oauth-credential',
      }),
    );

    expect(parsed).toEqual({
      email: 'user@example.com',
      keyHash: '[REDACTED]',
      credential: '[REDACTED]',
    });
  });

  it('redacts malformed legacy change blobs that appear to contain secrets', () => {
    expect(parseAuditLogChanges('password=plaintext')).toEqual({ raw: '[REDACTED]' });
    expect(parseAuditLogChanges('legacy note')).toEqual({ raw: 'legacy note' });
  });
});

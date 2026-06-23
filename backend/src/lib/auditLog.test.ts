import { describe, expect, it, vi } from 'vitest';
import {
  AuditAction,
  parseAuditLogChanges,
  sanitizeAuditChanges,
  writeAuditLogInTransaction,
} from './auditLog.js';

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

describe('writeAuditLogInTransaction (M73 hard-fail)', () => {
  it('writes the audit entry through the provided transaction client with sanitized changes', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'audit-1' });
    const tx = { auditLog: { create } } as never;

    await writeAuditLogInTransaction(tx, {
      userId: 'user-1',
      entityType: 'api_key',
      entityId: 'key-1',
      action: AuditAction.API_KEY_CREATED,
      changes: { name: 'CI key', secret: 'sp_live_should_be_redacted' },
    });

    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      userId: 'user-1',
      entityType: 'api_key',
      entityId: 'key-1',
      action: 'api_key_created',
    });
    expect(JSON.parse(data.changes)).toEqual({ name: 'CI key', secret: '[REDACTED]' });
  });

  it('propagates the error (does NOT swallow) so the surrounding transaction rolls back', async () => {
    const create = vi.fn().mockRejectedValue(new Error('audit insert failed'));
    const tx = { auditLog: { create } } as never;

    await expect(
      writeAuditLogInTransaction(tx, {
        userId: 'user-1',
        entityType: 'company',
        entityId: 'company-1',
        action: AuditAction.COMPANY_OWNERSHIP_TRANSFERRED,
      }),
    ).rejects.toThrow('audit insert failed');
  });
});

import { describe, expect, it } from 'vitest';

import { sanitizeLogText } from './logSanitization.js';

describe('sanitizeLogText', () => {
  it('redacts query-style sensitive values', () => {
    expect(sanitizeLogText('token=secret-value&ok=true')).toBe('token=[REDACTED]&ok=true');
    expect(sanitizeLogText('Authorization: Bearer abc.def.ghi')).toBe('Authorization=[REDACTED]');
  });

  it('redacts JSON-style sensitive values', () => {
    expect(sanitizeLogText('{"token":"secret-value","ok":true}')).toBe(
      '{"token":"[REDACTED]","ok":true}',
    );
    expect(sanitizeLogText("{'api_key':'secret-value','ok':true}")).toBe(
      "{'api_key':'[REDACTED]','ok':true}",
    );
  });

  it('redacts hold-point capability tokens in every public/batch path shape', () => {
    const token = 'a'.repeat(64);

    // Single-token routes (existing behavior must keep working).
    expect(sanitizeLogText(`/api/holdpoints/public/${token}`)).toBe(
      '/api/holdpoints/public/[REDACTED]',
    );
    expect(sanitizeLogText(`/api/holdpoints/public/${token}/release`)).toBe(
      '/api/holdpoints/public/[REDACTED]/release',
    );

    // Batch routes: the raw token must be redacted, not the static "batch" segment.
    for (const path of [
      `/api/holdpoints/public/batch/${token}`,
      `/api/holdpoints/public/batch/${token}/release`,
      `/api/holdpoints/public/batch/${token}/holdpoints/hp-1/documents/doc-1`,
    ]) {
      const sanitized = sanitizeLogText(path);
      expect(sanitized).not.toContain(token);
      expect(sanitized.startsWith('/api/holdpoints/public/batch/[REDACTED]')).toBe(true);
    }
  });

  it('redacts hold-point tokens in the frontend release path shapes', () => {
    const token = 'b'.repeat(64);
    expect(sanitizeLogText(`/hp-release/${token}`)).toBe('/hp-release/[REDACTED]');
    expect(sanitizeLogText(`/hp-release/batch/${token}`)).toBe('/hp-release/batch/[REDACTED]');
  });

  it('redacts subcontractor invitation tokens anywhere in a path', () => {
    const token = `sub_invite_${'c'.repeat(64)}`;
    expect(sanitizeLogText(`/api/subcontractors/invitation/${token}`)).toBe(
      '/api/subcontractors/invitation/[REDACTED]',
    );
    expect(sanitizeLogText(`/api/subcontractors/invitation/${token}/accept`)).toBe(
      '/api/subcontractors/invitation/[REDACTED]/accept',
    );
  });
});

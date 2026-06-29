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
});

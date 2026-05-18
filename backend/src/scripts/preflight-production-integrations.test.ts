import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const VALID_JWT_SECRET = 'prod-jwt-secret-32-plus-chars-2026';
const VALID_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('production integration preflight', () => {
  it('fails closed when durable Supabase storage is missing even if local storage is enabled', () => {
    const result = spawnSync(
      process.execPath,
      [
        join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs'),
        'scripts/preflight-production-integrations.ts',
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: 'production',
          DATABASE_URL: 'postgresql://user:pass@example.com:5432/siteproof',
          JWT_SECRET: VALID_JWT_SECRET,
          ENCRYPTION_KEY: VALID_ENCRYPTION_KEY,
          FRONTEND_URL: 'https://app.siteproof.example',
          BACKEND_URL: 'https://api.siteproof.example',
          EMAIL_ENABLED: 'false',
          ALLOW_LOCAL_FILE_STORAGE: 'true',
          REQUIRE_DURABLE_STORAGE: '',
          SUPABASE_URL: '',
          SUPABASE_SERVICE_ROLE_KEY: '',
          SUPABASE_ANON_KEY: '',
          GOOGLE_CLIENT_ID: '',
          GOOGLE_CLIENT_SECRET: '',
          GOOGLE_REDIRECT_URI: '',
          VAPID_PUBLIC_KEY: '',
          VAPID_PRIVATE_KEY: '',
          VAPID_SUBJECT: '',
        },
        encoding: 'utf8',
      },
    );

    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).toBe(1);
    expect(output).toContain('[fail] supabase-storage');
    expect(output).toContain(
      'Ephemeral local file storage is not acceptable for production uploads',
    );
    expect(output).not.toContain('durable Supabase storage intentionally bypassed');
  });
});

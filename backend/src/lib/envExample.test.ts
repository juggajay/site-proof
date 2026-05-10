import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const envExamplePath = new URL('../../.env.example', import.meta.url);

async function readEnvExample() {
  return readFile(envExamplePath, 'utf8');
}

describe('.env.example', () => {
  it('documents the production storage configuration expected by runtime validation', async () => {
    const envExample = await readEnvExample();

    expect(envExample).toMatch(/^SUPABASE_URL=/m);
    expect(envExample).toMatch(/^SUPABASE_SERVICE_ROLE_KEY=/m);
    expect(envExample).toMatch(/^SUPABASE_ANON_KEY=/m);
    expect(envExample).toMatch(/^ALLOW_LOCAL_FILE_STORAGE=/m);
    expect(envExample).not.toMatch(/^SUPABASE_SERVICE_KEY=/m);
  });

  it('documents the disposable shadow database used by Prisma drift checks', async () => {
    const envExample = await readEnvExample();

    expect(envExample).toMatch(/^SHADOW_DATABASE_URL=/m);
  });

  it('documents the explicit opt-in required for external test databases', async () => {
    const envExample = await readEnvExample();

    expect(envExample).toMatch(/^ALLOW_EXTERNAL_TEST_DATABASE=false/m);
  });

  it('documents configurable support contact values used by the support API', async () => {
    const envExample = await readEnvExample();
    const supportEnvNames = [
      'SUPPORT_EMAIL',
      'SUPPORT_PHONE',
      'SUPPORT_PHONE_LABEL',
      'SUPPORT_EMERGENCY_PHONE',
      'SUPPORT_ADDRESS',
      'SUPPORT_HOURS',
      'SUPPORT_RESPONSE_CRITICAL',
      'SUPPORT_RESPONSE_STANDARD',
      'SUPPORT_RESPONSE_GENERAL',
    ];

    for (const envName of supportEnvNames) {
      expect(envExample).toMatch(new RegExp(`^${envName}=`, 'm'));
    }
  });

  it('documents the dedicated public support request rate limit', async () => {
    const envExample = await readEnvExample();

    expect(envExample).toMatch(/^SUPPORT_RATE_LIMIT_MAX=/m);
  });

  it('documents the configurable webhook delivery timeout', async () => {
    const envExample = await readEnvExample();

    expect(envExample).toMatch(/^WEBHOOK_DELIVERY_TIMEOUT_MS=/m);
  });

  it('documents bounded local error logging controls', async () => {
    const envExample = await readEnvExample();

    expect(envExample).toMatch(/^ERROR_LOG_TO_FILE=/m);
    expect(envExample).toMatch(/^ERROR_LOG_MAX_BYTES=/m);
  });
});

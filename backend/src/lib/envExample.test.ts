import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const envExamplePath = new URL('../../.env.example', import.meta.url);

async function readEnvExample() {
  return readFile(envExamplePath, 'utf8');
}

function expectDocumentedEnvVars(envExample: string, envNames: string[]): void {
  for (const envName of envNames) {
    expect(envExample).toMatch(new RegExp(`^${envName}=`, 'm'));
  }
}

describe('.env.example', () => {
  it('documents the production storage configuration expected by runtime validation', async () => {
    const envExample = await readEnvExample();

    expectDocumentedEnvVars(envExample, [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_ANON_KEY',
      'ALLOW_LOCAL_FILE_STORAGE',
    ]);
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
    expectDocumentedEnvVars(envExample, [
      'SUPPORT_EMAIL',
      'SUPPORT_PHONE',
      'SUPPORT_PHONE_LABEL',
      'SUPPORT_EMERGENCY_PHONE',
      'SUPPORT_ADDRESS',
      'SUPPORT_HOURS',
      'SUPPORT_RESPONSE_CRITICAL',
      'SUPPORT_RESPONSE_STANDARD',
      'SUPPORT_RESPONSE_GENERAL',
    ]);
  });

  it('documents the dedicated public endpoint rate limits', async () => {
    const envExample = await readEnvExample();

    expectDocumentedEnvVars(envExample, [
      'VERIFICATION_RESEND_RATE_LIMIT_MAX',
      'SUPPORT_RATE_LIMIT_MAX',
    ]);
  });

  it('documents the configurable webhook delivery timeout', async () => {
    const envExample = await readEnvExample();

    expect(envExample).toMatch(/^WEBHOOK_DELIVERY_TIMEOUT_MS=/m);
  });

  it('documents bounded local error logging controls', async () => {
    const envExample = await readEnvExample();

    expectDocumentedEnvVars(envExample, ['ERROR_LOG_TO_FILE', 'ERROR_LOG_MAX_BYTES']);
  });

  it('documents the Sentry error monitoring configuration required in production', async () => {
    const envExample = await readEnvExample();

    expectDocumentedEnvVars(envExample, [
      'SENTRY_DSN',
      'SENTRY_ENVIRONMENT',
      'SENTRY_RELEASE',
      'SENTRY_TRACES_SAMPLE_RATE',
    ]);
    expect(envExample).not.toMatch(/^ERROR_MONITORING_ENDPOINT_URL=/m);
  });
});

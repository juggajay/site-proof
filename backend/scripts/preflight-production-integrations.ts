#!/usr/bin/env tsx
import 'dotenv/config';

type PreflightStatus = 'pass' | 'skip' | 'fail';

interface PreflightResult {
  name: string;
  status: PreflightStatus;
  message: string;
}

const PREFLIGHT_TIMEOUT_MS = Number(process.env.PREFLIGHT_TIMEOUT_MS || 10000);
const DOCUMENTS_BUCKET = 'documents';
const RESEND_DOMAINS_ENDPOINT = 'https://api.resend.com/domains';
const GOOGLE_OPENID_CONFIGURATION_ENDPOINT =
  'https://accounts.google.com/.well-known/openid-configuration';

function readEnv(name: string): string {
  return process.env[name]?.trim() || '';
}

function isEnabled(value: string | undefined): boolean {
  return ['1', 'true', 'yes'].includes(value?.trim().toLowerCase() ?? '');
}

function getJsonProperty(value: unknown, property: string): unknown {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  return (value as Record<string, unknown>)[property];
}

function extractEmailDomain(value: string): string | null {
  const displayNameMatch = value.match(/^[^<>]*<([^<>]+)>$/);
  const address = (displayNameMatch?.[1] ?? value).trim().toLowerCase();
  const [, domain] = address.match(/^[^\s@]+@([^\s@]+\.[^\s@]+)$/) ?? [];
  return domain ?? null;
}

function domainMatchesSender(senderDomain: string, configuredDomain: string): boolean {
  return senderDomain === configuredDomain || senderDomain.endsWith(`.${configuredDomain}`);
}

async function readResponseText(response: Response): Promise<string> {
  const text = await response.text().catch(() => '');
  return text.slice(0, 500);
}

function safeUrlForLog(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

async function runNetworkRequest(
  label: string,
  url: string,
  request: () => Promise<Response>,
): Promise<Response> {
  try {
    return await request();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} request failed for ${safeUrlForLog(url)}: ${reason}`);
  }
}

async function runCheck(
  name: string,
  check: () => Promise<Omit<PreflightResult, 'name'>>,
): Promise<PreflightResult> {
  try {
    return { name, ...(await check()) };
  } catch (error) {
    return {
      name,
      status: 'fail',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function pass(message: string): Omit<PreflightResult, 'name'> {
  return { status: 'pass', message };
}

function skip(message: string): Omit<PreflightResult, 'name'> {
  return { status: 'skip', message };
}

async function checkRuntimeConfig(): Promise<Omit<PreflightResult, 'name'>> {
  const { validateRuntimeConfig } = await import('../src/lib/runtimeConfig.js');
  validateRuntimeConfig();
  return pass('Production runtime configuration validates.');
}

async function checkResend(): Promise<Omit<PreflightResult, 'name'>> {
  if (readEnv('EMAIL_ENABLED') === 'false') {
    return skip('EMAIL_ENABLED=false; email delivery intentionally disabled.');
  }

  const apiKey = readEnv('RESEND_API_KEY');
  const senderDomain = extractEmailDomain(readEnv('EMAIL_FROM'));
  if (!apiKey || !senderDomain) {
    throw new Error('RESEND_API_KEY and EMAIL_FROM are required for email delivery preflight.');
  }

  const { fetchWithTimeout } = await import('../src/lib/fetchWithTimeout.js');
  const response = await runNetworkRequest('Resend domains check', RESEND_DOMAINS_ENDPOINT, () =>
    fetchWithTimeout(
      RESEND_DOMAINS_ENDPOINT,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
      },
      PREFLIGHT_TIMEOUT_MS,
    ),
  );

  if (!response.ok) {
    throw new Error(
      `Resend domains check failed with HTTP ${response.status}: ${await readResponseText(response)}`,
    );
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  const data = getJsonProperty(payload, 'data');
  const domains = Array.isArray(data) ? data : [];
  const matchingDomain = domains
    .map((domain) => ({
      name: String(getJsonProperty(domain, 'name') ?? '').toLowerCase(),
      status: String(getJsonProperty(domain, 'status') ?? '').toLowerCase(),
    }))
    .find((domain) => domain.name && domainMatchesSender(senderDomain, domain.name));

  if (!matchingDomain) {
    throw new Error(
      `Resend API key is valid, but EMAIL_FROM domain ${senderDomain} is not listed.`,
    );
  }

  if (matchingDomain.status && matchingDomain.status !== 'verified') {
    throw new Error(
      `Resend domain ${matchingDomain.name} is present but not verified (status=${matchingDomain.status}).`,
    );
  }

  return pass(`Resend key is valid and sender domain ${senderDomain} is verified.`);
}

async function checkSupabaseStorage(): Promise<Omit<PreflightResult, 'name'>> {
  const supabaseUrl = readEnv('SUPABASE_URL');
  const serviceRoleKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');
  const requireDurableStorage = isEnabled(process.env.REQUIRE_DURABLE_STORAGE);

  if (!supabaseUrl && !serviceRoleKey && isEnabled(process.env.ALLOW_LOCAL_FILE_STORAGE)) {
    if (!requireDurableStorage) {
      return skip('ALLOW_LOCAL_FILE_STORAGE=true; durable Supabase storage intentionally bypassed.');
    }
  }

  // production-preflight.yml sets REQUIRE_DURABLE_STORAGE=true. In that mode
  // local Railway disk is never acceptable because uploads vanish on redeploy.
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for production. ' +
        'Ephemeral local file storage is not acceptable for production uploads.',
    );
  }

  const { fetchWithTimeout } = await import('../src/lib/fetchWithTimeout.js');
  const bucketsUrl = new URL('/storage/v1/bucket', supabaseUrl).toString();
  const response = await runNetworkRequest('Supabase bucket list', bucketsUrl, () =>
    fetchWithTimeout(
      bucketsUrl,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Accept: 'application/json',
        },
      },
      PREFLIGHT_TIMEOUT_MS,
    ),
  );

  if (!response.ok) {
    throw new Error(
      `Supabase bucket list failed with HTTP ${response.status}: ${await readResponseText(response)}`,
    );
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  const buckets = Array.isArray(payload) ? payload : [];
  const documentsBucket = buckets.find((bucket) => {
    const id = String(getJsonProperty(bucket, 'id') ?? '');
    const name = String(getJsonProperty(bucket, 'name') ?? '');
    return id === DOCUMENTS_BUCKET || name === DOCUMENTS_BUCKET;
  });

  if (!documentsBucket) {
    throw new Error(`Supabase Storage bucket "${DOCUMENTS_BUCKET}" was not found.`);
  }

  if (getJsonProperty(documentsBucket, 'public') === false) {
    throw new Error(
      `Supabase Storage bucket "${DOCUMENTS_BUCKET}" must be public for stored URLs.`,
    );
  }

  return pass(`Supabase Storage bucket "${DOCUMENTS_BUCKET}" is reachable.`);
}

async function checkGoogleOAuth(): Promise<Omit<PreflightResult, 'name'>> {
  const clientId = readEnv('GOOGLE_CLIENT_ID');
  const clientSecret = readEnv('GOOGLE_CLIENT_SECRET');
  const redirectUriConfigured = Boolean(readEnv('GOOGLE_REDIRECT_URI'));

  if (!clientId && !clientSecret && !redirectUriConfigured) {
    return skip('Google OAuth is not configured.');
  }

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured together.');
  }

  if (!clientId.endsWith('.apps.googleusercontent.com')) {
    throw new Error('GOOGLE_CLIENT_ID must be a Google OAuth web client id.');
  }

  const { fetchWithTimeout } = await import('../src/lib/fetchWithTimeout.js');
  const { getGoogleRedirectUri } = await import('../src/lib/runtimeConfig.js');
  const redirectUri = getGoogleRedirectUri();
  const response = await runNetworkRequest(
    'Google OpenID configuration',
    GOOGLE_OPENID_CONFIGURATION_ENDPOINT,
    () =>
      fetchWithTimeout(
        GOOGLE_OPENID_CONFIGURATION_ENDPOINT,
        { headers: { Accept: 'application/json' } },
        PREFLIGHT_TIMEOUT_MS,
      ),
  );

  if (!response.ok) {
    throw new Error(
      `Google OpenID configuration check failed with HTTP ${response.status}: ${await readResponseText(response)}`,
    );
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  if (
    getJsonProperty(payload, 'issuer') !== 'https://accounts.google.com' ||
    typeof getJsonProperty(payload, 'authorization_endpoint') !== 'string' ||
    typeof getJsonProperty(payload, 'token_endpoint') !== 'string'
  ) {
    throw new Error('Google OpenID configuration response is missing expected endpoints.');
  }

  return pass(`Google OAuth metadata is reachable; redirect URI is ${redirectUri}.`);
}

async function checkVapid(): Promise<Omit<PreflightResult, 'name'>> {
  const publicKey = readEnv('VAPID_PUBLIC_KEY');
  const privateKey = readEnv('VAPID_PRIVATE_KEY');
  const subject = readEnv('VAPID_SUBJECT');

  if (!publicKey && !privateKey && !subject) {
    return skip('VAPID push notifications are not configured.');
  }

  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      'VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT are required together.',
    );
  }

  const webpush = await import('web-push');
  webpush.default.setVapidDetails(subject, publicKey, privateKey);
  return pass('VAPID keys are accepted by web-push.');
}

async function main(): Promise<void> {
  process.env.NODE_ENV = 'production';

  const results = await Promise.all([
    runCheck('runtime-config', checkRuntimeConfig),
    runCheck('resend-email', checkResend),
    runCheck('supabase-storage', checkSupabaseStorage),
    runCheck('google-oauth', checkGoogleOAuth),
    runCheck('vapid-push', checkVapid),
  ]);

  for (const result of results) {
    console.log(`[${result.status}] ${result.name}: ${result.message}`);
  }

  const failures = results.filter((result) => result.status === 'fail');
  if (failures.length > 0) {
    console.error(`\nProduction integration preflight failed (${failures.length} check(s)).`);
    process.exit(1);
  }

  console.log('\nProduction integration preflight passed.');
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

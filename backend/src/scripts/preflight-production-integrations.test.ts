import { spawn, spawnSync } from 'node:child_process';
import http, { type Server } from 'node:http';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const VALID_JWT_SECRET = 'prod-jwt-secret-32-plus-chars-2026';
const VALID_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const VALID_SENTRY_DSN = 'https://public@example.ingest.sentry.io/123456';

let testServer: Server | null = null;

afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    if (!testServer) {
      resolve();
      return;
    }

    testServer.close((error) => (error ? reject(error) : resolve()));
    testServer = null;
  });
});

function startSupabaseStorageServer(options: {
  bucketPublicValue: boolean;
  uploadStatus?: number;
  uploadBody?: Record<string, unknown>;
  deleteStatus?: number;
  deleteBody?: Record<string, unknown>;
}): Promise<string> {
  return new Promise((resolve) => {
    testServer = http.createServer((req, res) => {
      if (req.url !== '/storage/v1/bucket') {
        if (req.url?.startsWith('/storage/v1/object/documents/siteproof-preflight/')) {
          res.statusCode = options.uploadStatus ?? 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(options.uploadBody ?? { Key: req.url }));
          return;
        }

        if (req.url === '/storage/v1/object/documents' && req.method === 'DELETE') {
          res.statusCode = options.deleteStatus ?? 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(options.deleteBody ?? [{ name: 'probe.txt' }]));
          return;
        }

        res.statusCode = 404;
        res.end('not found');
        return;
      }

      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify([{ id: 'documents', name: 'documents', public: options.bucketPublicValue }]),
      );
    });

    testServer.listen(0, '127.0.0.1', () => {
      const address = testServer?.address();
      if (!address || typeof address === 'string') {
        throw new Error('Expected test server to listen on a TCP port');
      }
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function startResendServer(options: {
  domainStatus?: string;
  sendStatus?: number;
  sendBody?: Record<string, unknown>;
}): Promise<string> {
  return new Promise((resolve) => {
    testServer = http.createServer((req, res) => {
      if (req.url === '/domains') {
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            data: [
              {
                name: 'siteproof.example',
                status: options.domainStatus ?? 'verified',
              },
            ],
          }),
        );
        return;
      }

      if (req.url === '/emails' && req.method === 'POST') {
        res.statusCode = options.sendStatus ?? 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(options.sendBody ?? { id: 'email_preflight_123' }));
        return;
      }

      res.statusCode = 404;
      res.end('not found');
    });

    testServer.listen(0, '127.0.0.1', () => {
      const address = testServer?.address();
      if (!address || typeof address === 'string') {
        throw new Error('Expected test server to listen on a TCP port');
      }
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function getPreflightEnv(extraEnv: Record<string, string>) {
  return {
    ...process.env,
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://user:pass@example.com:5432/siteproof',
    JWT_SECRET: VALID_JWT_SECRET,
    ENCRYPTION_KEY: VALID_ENCRYPTION_KEY,
    FRONTEND_URL: 'https://app.siteproof.example',
    BACKEND_URL: 'https://api.siteproof.example',
    EMAIL_ENABLED: 'false',
    ALLOW_LOCAL_FILE_STORAGE: 'false',
    REQUIRE_DURABLE_STORAGE: '',
    SENTRY_DSN: VALID_SENTRY_DSN,
    SUPABASE_URL: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
    SUPABASE_ANON_KEY: '',
    GOOGLE_CLIENT_ID: '',
    GOOGLE_CLIENT_SECRET: '',
    GOOGLE_REDIRECT_URI: '',
    VAPID_PUBLIC_KEY: '',
    VAPID_PRIVATE_KEY: '',
    VAPID_SUBJECT: '',
    ...extraEnv,
  };
}

const preflightCommand = [
  join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs'),
  'scripts/preflight-production-integrations.ts',
];

function runPreflight(extraEnv: Record<string, string>) {
  return spawnSync(process.execPath, preflightCommand, {
    cwd: process.cwd(),
    env: getPreflightEnv(extraEnv),
    encoding: 'utf8',
  });
}

function runPreflightAsync(extraEnv: Record<string, string>) {
  return new Promise<{ status: number | null; stdout: string; stderr: string }>(
    (resolve, reject) => {
      const child = spawn(process.execPath, preflightCommand, {
        cwd: process.cwd(),
        env: getPreflightEnv(extraEnv),
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
      child.on('error', reject);
      child.on('close', (status) => resolve({ status, stdout, stderr }));
    },
  );
}

describe('production integration preflight', () => {
  it('passes the Resend check only after the provider accepts a send probe', async () => {
    const resendUrl = await startResendServer({});

    const result = await runPreflightAsync({
      EMAIL_ENABLED: 'true',
      EMAIL_FROM: 'SiteProof <noreply@siteproof.example>',
      RESEND_API_KEY: 're_valid_test_key',
      RESEND_DOMAINS_ENDPOINT: `${resendUrl}/domains`,
      RESEND_EMAILS_ENDPOINT: `${resendUrl}/emails`,
    });

    const output = `${result.stdout}\n${result.stderr}`;

    expect(output).toContain('[pass] resend-email');
    expect(output).toContain('a test email was accepted');
  });

  it('fails the Resend check when the provider rejects the send probe', async () => {
    const resendUrl = await startResendServer({
      sendStatus: 403,
      sendBody: { message: 'The siteproof.example sender is not allowed' },
    });

    const result = await runPreflightAsync({
      EMAIL_ENABLED: 'true',
      EMAIL_FROM: 'SiteProof <noreply@siteproof.example>',
      RESEND_API_KEY: 're_valid_test_key',
      RESEND_DOMAINS_ENDPOINT: `${resendUrl}/domains`,
      RESEND_EMAILS_ENDPOINT: `${resendUrl}/emails`,
    });

    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).toBe(1);
    expect(output).toContain('[fail] resend-email');
    expect(output).toContain('Resend send probe failed with HTTP 403');
    expect(output).toContain('sender is not allowed');
  });

  it('fails closed when durable Supabase storage is missing even if local storage is enabled', () => {
    const result = runPreflight({
      ALLOW_LOCAL_FILE_STORAGE: 'true',
    });

    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).toBe(1);
    expect(output).toContain('[fail] supabase-storage');
    expect(output).toContain(
      'Ephemeral local file storage is not acceptable for production uploads',
    );
    expect(output).not.toContain('durable Supabase storage intentionally bypassed');
  });

  it('fails when the documents bucket is public', async () => {
    const supabaseUrl = await startSupabaseStorageServer({ bucketPublicValue: true });

    const result = await runPreflightAsync({
      SUPABASE_URL: supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: 's'.repeat(32),
    });

    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).toBe(1);
    expect(output).toContain('[fail] supabase-storage');
    expect(output).toContain('must be private');
  });

  it('passes the Supabase storage check when the documents bucket is private', async () => {
    const supabaseUrl = await startSupabaseStorageServer({ bucketPublicValue: false });

    const result = await runPreflightAsync({
      SUPABASE_URL: supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: 's'.repeat(32),
    });

    const output = `${result.stdout}\n${result.stderr}`;

    expect(output).toContain('[pass] supabase-storage');
    expect(output).toContain('accepts upload/delete probes');
  });

  it('fails the Supabase storage check when the service role cannot upload', async () => {
    const supabaseUrl = await startSupabaseStorageServer({
      bucketPublicValue: false,
      uploadStatus: 403,
      uploadBody: { message: 'insert denied for storage object' },
    });

    const result = await runPreflightAsync({
      SUPABASE_URL: supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: 's'.repeat(32),
    });

    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).toBe(1);
    expect(output).toContain('[fail] supabase-storage');
    expect(output).toContain('Supabase storage upload probe failed with HTTP 403');
    expect(output).toContain('insert denied for storage object');
  });
});

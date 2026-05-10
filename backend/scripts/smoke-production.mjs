import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, URL } from 'node:url';
import { config as loadEnv } from 'dotenv';

const backendRoot = fileURLToPath(new URL('../', import.meta.url));
const serverEntry = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const envPath = fileURLToPath(new URL('../.env', import.meta.url));

loadEnv({ path: envPath });

const port =
  process.env.PRODUCTION_SMOKE_PORT || process.env.SMOKE_PORT || process.env.PORT || '4011';
const localBaseUrl = `http://127.0.0.1:${port}`;
const healthUrl = `${localBaseUrl}/health`;
const readyUrl = `${localBaseUrl}/ready`;

const forcedSmokeEnv = {
  NODE_ENV: 'production',
  PORT: port,
  TRUST_PROXY: 'true',
  EMAIL_ENABLED: 'false',
  SCHEDULED_REPORT_WORKER_ENABLED: 'false',
  NOTIFICATION_DIGEST_WORKER_ENABLED: 'false',
  NOTIFICATION_AUTOMATION_WORKER_ENABLED: 'false',
};

function getConfiguredBackendUrl() {
  const configured = process.env.BACKEND_URL?.trim() || process.env.API_URL?.trim();

  if (!configured) {
    throw new Error('BACKEND_URL or API_URL is required for the production smoke check.');
  }

  const parsed = new URL(configured);
  if (parsed.protocol !== 'https:') {
    throw new Error('BACKEND_URL or API_URL must use https for the production smoke check.');
  }

  return parsed.toString().replace(/\/$/, '');
}

function tail(lines, count = 20) {
  return lines.slice(-count).join('');
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForServer(server, stdout, stderr) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(
        `Production server exited before becoming healthy.\n\nstdout:\n${tail(stdout)}\n\nstderr:\n${tail(stderr)}`,
      );
    }

    try {
      const response = await fetchWithTimeout(healthUrl, {
        headers: { 'X-Forwarded-Proto': 'https' },
      });
      if (response.status === 200) {
        return;
      }
    } catch {
      // The server is still starting.
    }

    await delay(500);
  }

  throw new Error(`Production server did not become healthy at ${healthUrl}.`);
}

async function expectJsonStatus(url, expectedBodyStatus) {
  const response = await fetchWithTimeout(url, {
    headers: { 'X-Forwarded-Proto': 'https' },
  });
  const body = await response.json().catch(() => null);

  if (response.status !== 200 || body?.status !== expectedBodyStatus) {
    throw new Error(
      `${url} expected HTTP 200 with status=${expectedBodyStatus}, got HTTP ${
        response.status
      } and body ${JSON.stringify(body)}`,
    );
  }
}

async function expectHttpRedirect(expectedLocation) {
  const response = await fetchWithTimeout(healthUrl, { redirect: 'manual' });
  const location = response.headers.get('location');

  if (response.status !== 301 || location !== expectedLocation) {
    throw new Error(
      `HTTP health check expected 301 redirect to ${expectedLocation}, got HTTP ${response.status} Location=${location}`,
    );
  }

  return location;
}

async function main() {
  await access(serverEntry);

  const expectedRedirectLocation = `${getConfiguredBackendUrl()}/health`;
  const server = spawn(process.execPath, [serverEntry], {
    cwd: backendRoot,
    env: {
      ...process.env,
      ...forcedSmokeEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const stdout = [];
  const stderr = [];
  server.stdout.on('data', (chunk) => stdout.push(chunk.toString()));
  server.stderr.on('data', (chunk) => stderr.push(chunk.toString()));

  try {
    await waitForServer(server, stdout, stderr);
    await expectJsonStatus(healthUrl, 'ok');
    await expectJsonStatus(readyUrl, 'ready');
    const redirectLocation = await expectHttpRedirect(expectedRedirectLocation);

    console.log('Production smoke passed.');
    console.log(`- HTTPS proxy health: ${healthUrl}`);
    console.log(`- HTTPS proxy readiness: ${readyUrl}`);
    console.log(`- HTTP redirect: ${redirectLocation}`);
  } finally {
    if (server.exitCode === null) {
      server.kill('SIGTERM');
      await delay(500);
      if (server.exitCode === null) {
        server.kill('SIGKILL');
      }
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

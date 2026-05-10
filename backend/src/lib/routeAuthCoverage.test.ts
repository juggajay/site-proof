import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const routesDir = fileURLToPath(new URL('../routes/', import.meta.url));
const serverPath = fileURLToPath(new URL('../server.ts', import.meta.url));

const allowedPublicRouteFiles = new Set([
  'auth.ts',
  'oauth.ts',
  'support.ts',
  'documents.ts',
  'holdpoints.ts',
  'mfa.ts',
  'subcontractors.ts',
  'webhooks.ts',
]);

const parentProtectedRoutePrefixes = new Set(['diary/']);

const routeDeclarationPattern = /\b(?:router|[A-Za-z]+Router)\.(get|post|put|patch|delete)\(/;
const routeDescriptorPattern =
  /\b(?:router|[A-Za-z]+Router)\.(get|post|put|patch|delete)\(\s*(['"`])([^'"`]+)\2/g;

interface RouteCall {
  descriptor: string;
  source: string;
}

async function collectRouteFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return collectRouteFiles(entryPath);
      }

      if (!entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) {
        return [];
      }

      return [entryPath];
    }),
  );

  return nested.flat();
}

function relativeRoutePath(filePath: string): string {
  return path.relative(routesDir, filePath).replace(/\\/g, '/');
}

function routeCalls(source: string): RouteCall[] {
  const matches = Array.from(source.matchAll(routeDescriptorPattern));

  return matches.map((match, index) => ({
    descriptor: `${match[1].toUpperCase()} ${match[3]}`,
    source: source.slice(match.index, matches[index + 1]?.index ?? source.length),
  }));
}

function hasRouteWideAuth(source: string): boolean {
  return /\b(?:router|[A-Za-z]+Router)\.use\(requireAuth\)/.test(source);
}

function isProtectedByParentRoute(relativePath: string): boolean {
  return Array.from(parentProtectedRoutePrefixes).some((prefix) => relativePath.startsWith(prefix));
}

function publicRouteDescriptorsBeforeRouteWideAuth(source: string): string[] {
  const preAuthSource =
    source.split(/\b(?:router|[A-Za-z]+Router)\.use\(requireAuth\)/)[0] ?? source;
  return routeCalls(preAuthSource)
    .filter((route) => !route.source.includes('requireAuth'))
    .map((route) => route.descriptor);
}

function unprotectedRouteDescriptors(source: string): string[] {
  return routeCalls(source)
    .filter((route) => !route.source.includes('requireAuth'))
    .map((route) => route.descriptor);
}

function routeSourceForDescriptor(source: string, descriptor: string): string {
  const route = routeCalls(source).find((candidate) => candidate.descriptor === descriptor);
  expect(route, `Expected route descriptor ${descriptor} to exist`).toBeDefined();
  return route!.source;
}

describe('route authentication coverage', () => {
  it('keeps the public API surface explicit and reviewed', async () => {
    const files = await collectRouteFiles(routesDir);
    const offenders: string[] = [];

    for (const file of files) {
      const relativePath = relativeRoutePath(file);
      const source = await readFile(file, 'utf8');
      const routes = routeCalls(source);

      if (routes.length === 0 && !routeDeclarationPattern.test(source)) {
        continue;
      }

      if (allowedPublicRouteFiles.has(relativePath) || isProtectedByParentRoute(relativePath)) {
        continue;
      }

      if (hasRouteWideAuth(source)) {
        continue;
      }

      offenders.push(
        ...unprotectedRouteDescriptors(source).map(
          (descriptor) => `${relativePath}: ${descriptor}`,
        ),
      );
    }

    expect(offenders).toEqual([]);
  });

  it('limits mixed public/protected route modules to documented public endpoints', async () => {
    const authSource = await readFile(path.join(routesDir, 'auth.ts'), 'utf8');
    const oauthSource = await readFile(path.join(routesDir, 'oauth.ts'), 'utf8');
    const documentsSource = await readFile(path.join(routesDir, 'documents.ts'), 'utf8');
    const holdpointsSource = await readFile(path.join(routesDir, 'holdpoints.ts'), 'utf8');
    const mfaSource = await readFile(path.join(routesDir, 'mfa.ts'), 'utf8');
    const subcontractorsSource = await readFile(path.join(routesDir, 'subcontractors.ts'), 'utf8');
    const webhooksSource = await readFile(path.join(routesDir, 'webhooks.ts'), 'utf8');
    const serverSource = await readFile(serverPath, 'utf8');

    expect(routeCalls(authSource).map((route) => route.descriptor)).toEqual([
      'POST /register',
      'POST /login',
      'POST /magic-link/request',
      'POST /magic-link/verify',
      'GET /me',
      'POST /logout',
      'POST /logout-all-devices',
      'POST /forgot-password',
      'POST /reset-password',
      'GET /validate-reset-token',
      'PATCH /profile',
      'POST /avatar',
      'DELETE /avatar',
      'POST /change-password',
      'POST /verify-email',
      'GET /verify-email-status',
      'POST /resend-verification',
      'POST /test-expired-token',
      'GET /export-data',
      'POST /register-and-accept-invitation',
      'DELETE /delete-account',
    ]);
    expect(routeSourceForDescriptor(authSource, 'GET /me')).toContain('verifyToken(token)');
    expect(routeSourceForDescriptor(authSource, 'POST /logout-all-devices')).toContain(
      'verifyToken(token)',
    );
    expect(routeSourceForDescriptor(authSource, 'PATCH /profile')).toContain('requireJwtAuth');
    expect(routeSourceForDescriptor(authSource, 'POST /avatar')).toContain('requireJwtAuth');
    expect(routeSourceForDescriptor(authSource, 'DELETE /avatar')).toContain('requireJwtAuth');
    expect(routeSourceForDescriptor(authSource, 'POST /change-password')).toContain(
      'verifyToken(token)',
    );
    expect(routeSourceForDescriptor(authSource, 'POST /test-expired-token')).toContain(
      "ALLOW_TEST_AUTH_ENDPOINTS !== 'true'",
    );
    expect(routeSourceForDescriptor(authSource, 'GET /export-data')).toContain(
      'verifyToken(token)',
    );
    expect(routeSourceForDescriptor(authSource, 'DELETE /delete-account')).toContain(
      'verifyToken(token)',
    );
    expect(serverSource).toContain("app.use('/api/auth', authRateLimiter, authRouter)");

    expect(routeCalls(oauthSource).map((route) => route.descriptor)).toEqual([
      'GET /google',
      'GET /google/callback',
      'POST /google/token',
      'POST /oauth/exchange',
      'POST /oauth/mock',
    ]);
    expect(routeSourceForDescriptor(oauthSource, 'GET /google')).toContain('createOAuthState');
    expect(routeSourceForDescriptor(oauthSource, 'GET /google/callback')).toContain(
      'verifyOAuthState(state)',
    );
    expect(routeSourceForDescriptor(oauthSource, 'GET /google/callback')).toContain(
      'createOAuthCallbackCode',
    );
    expect(routeSourceForDescriptor(oauthSource, 'POST /google/token')).toContain(
      'authRateLimiter',
    );
    expect(routeSourceForDescriptor(oauthSource, 'POST /google/token')).toContain(
      'getGoogleCredentialPayload',
    );
    expect(routeSourceForDescriptor(oauthSource, 'POST /oauth/exchange')).toContain(
      'authRateLimiter',
    );
    expect(routeSourceForDescriptor(oauthSource, 'POST /oauth/exchange')).toContain(
      'consumeOAuthCallbackCode',
    );
    expect(routeSourceForDescriptor(oauthSource, 'POST /oauth/mock')).toContain('authRateLimiter');
    expect(routeSourceForDescriptor(oauthSource, 'POST /oauth/mock')).toContain(
      'isMockOAuthEnabled()',
    );

    expect(publicRouteDescriptorsBeforeRouteWideAuth(documentsSource)).toEqual([
      'GET /download/:documentId',
      'GET /signed-url/validate',
    ]);

    expect(publicRouteDescriptorsBeforeRouteWideAuth(holdpointsSource)).toEqual([
      'GET /public/:token',
      'POST /public/:token/release',
    ]);

    expect(unprotectedRouteDescriptors(mfaSource)).toEqual(['POST /verify']);
    expect(mfaSource).toContain('recordFailedAuthAttempt(getClientIp(req))');
    expect(mfaSource).toContain('clearFailedAuthAttempts(getClientIp(req))');

    expect(publicRouteDescriptorsBeforeRouteWideAuth(subcontractorsSource)).toEqual([
      'GET /invitation/:id',
    ]);

    expect(publicRouteDescriptorsBeforeRouteWideAuth(webhooksSource)).toEqual([
      'POST /test-receiver',
    ]);
    expect(webhooksSource).toContain('assertTestReceiverAvailable()');
    expect(webhooksSource).toContain("process.env.NODE_ENV === 'production'");

    expect(
      serverSource.indexOf("app.post('/api/support/request', supportRateLimiter)"),
    ).toBeLessThan(serverSource.indexOf("app.use('/api/support', supportRouter)"));
    expect(
      serverSource.indexOf("app.post('/api/support/client-error', supportRateLimiter)"),
    ).toBeLessThan(serverSource.indexOf("app.use('/api/support', supportRouter)"));
  });
});

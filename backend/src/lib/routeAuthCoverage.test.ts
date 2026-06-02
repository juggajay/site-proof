import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const routesDir = fileURLToPath(new URL('../routes/', import.meta.url));
const serverPath = fileURLToPath(new URL('../server.ts', import.meta.url));

const allowedPublicRouteFiles = new Set([
  'auth.ts',
  'auth/registrationRoutes.ts',
  'auth/passwordResetRoutes.ts',
  'oauth.ts',
  'support.ts',
  'documents.ts',
  'holdpoints.ts',
  'mfa.ts',
  'subcontractors.ts',
  'subcontractors/invitationRoutes.ts',
  'webhooks.ts',
]);

const parentProtectedRoutePrefixes = new Set([
  'dashboard/',
  'diary/',
  'dockets/',
  'documents/fileAccessRoutes.ts',
  'documents/classificationRoutes.ts',
  'notifications/',
  'lots/',
  'claims/evidenceRoutes.ts',
  'claims/workflowRoutes.ts',
  'subcontractors/myCompanyRoutes.ts',
  'subcontractors/portalAccessRoutes.ts',
]);

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

function routeSourceHasAuthMiddleware(source: string): boolean {
  return source.includes('requireAuth') || source.includes('requireJwtAuth');
}

function hasRouteWideAuth(source: string): boolean {
  return /\b(?:router|[A-Za-z]+Router)\.use\((?:requireAuth|requireJwtAuth)\)/.test(source);
}

function isProtectedByParentRoute(relativePath: string): boolean {
  return Array.from(parentProtectedRoutePrefixes).some((prefix) => relativePath.startsWith(prefix));
}

function publicRouteDescriptorsBeforeRouteWideAuth(source: string): string[] {
  const preAuthSource =
    source.split(/\b(?:router|[A-Za-z]+Router)\.use\((?:requireAuth|requireJwtAuth)\)/)[0] ??
    source;
  return routeCalls(preAuthSource)
    .filter((route) => !routeSourceHasAuthMiddleware(route.source))
    .map((route) => route.descriptor);
}

function extractedDocumentPublicRouteDescriptors(source: string): string[] {
  return Array.from(
    source.matchAll(/\bpublicRoutes\.(get|post|put|patch|delete)\(\s*(['"`])([^'"`]+)\2/g),
  ).map((match) => `${match[1].toUpperCase()} ${match[3]}`);
}

function extractedDocumentVersionRouteDescriptors(source: string): string[] {
  return Array.from(
    source.matchAll(/\bversionRoutes\.(get|post|put|patch|delete)\(\s*(['"`])([^'"`]+)\2/g),
  ).map((match) => `${match[1].toUpperCase()} ${match[3]}`);
}

function extractedDocumentFileAccessRouteDescriptors(source: string): string[] {
  return Array.from(
    source.matchAll(/\bfileAccessRoutes\.(get|post|put|patch|delete)\(\s*(['"`])([^'"`]+)\2/g),
  ).map((match) => `${match[1].toUpperCase()} ${match[3]}`);
}

function extractedDocumentClassificationRouteDescriptors(source: string): string[] {
  return Array.from(
    source.matchAll(/\bclassificationRoutes\.(get|post|put|patch|delete)\(\s*(['"`])([^'"`]+)\2/g),
  ).map((match) => `${match[1].toUpperCase()} ${match[3]}`);
}

function extractedSubcontractorInvitationPublicRouteDescriptors(source: string): string[] {
  return Array.from(
    source.matchAll(/\bpublicRouter\.(get|post|put|patch|delete)\(\s*(['"`])([^'"`]+)\2/g),
  ).map((match) => `${match[1].toUpperCase()} ${match[3]}`);
}

function extractedSubcontractorInvitationAuthenticatedRouteDescriptors(source: string): string[] {
  return Array.from(
    source.matchAll(/\bauthenticatedRouter\.(get|post|put|patch|delete)\(\s*(['"`])([^'"`]+)\2/g),
  ).map((match) => `${match[1].toUpperCase()} ${match[3]}`);
}

function extractedSubcontractorPortalAccessRouteDescriptors(source: string): string[] {
  return routeCalls(source).map((route) => route.descriptor);
}

function extractedSubcontractorAdminRouteDescriptors(source: string): string[] {
  return routeCalls(source).map((route) => route.descriptor);
}

function extractedClaimWorkflowRouteDescriptors(source: string): string[] {
  return Array.from(
    source.matchAll(
      /\b(?:workflowRouter|postEvidenceWorkflowRouter)\.(get|post|put|patch|delete)\(\s*(['"`])([^'"`]+)\2/g,
    ),
  ).map((match) => `${match[1].toUpperCase()} ${match[3]}`);
}

function extractedPasswordResetRouteDescriptors(source: string): string[] {
  return routeCalls(source).map((route) => route.descriptor);
}

function extractedRegistrationRouteDescriptors(source: string): string[] {
  return routeCalls(source).map((route) => route.descriptor);
}

function extractedProfileRouteDescriptors(source: string): string[] {
  return routeCalls(source).map((route) => route.descriptor);
}

function unprotectedRouteDescriptors(source: string): string[] {
  return routeCalls(source)
    .filter((route) => !routeSourceHasAuthMiddleware(route.source))
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
    const registrationRoutesSource = await readFile(
      path.join(routesDir, 'auth/registrationRoutes.ts'),
      'utf8',
    );
    const passwordResetRoutesSource = await readFile(
      path.join(routesDir, 'auth/passwordResetRoutes.ts'),
      'utf8',
    );
    const profileRoutesSource = await readFile(
      path.join(routesDir, 'auth/profileRoutes.ts'),
      'utf8',
    );
    const oauthSource = await readFile(path.join(routesDir, 'oauth.ts'), 'utf8');
    const documentsSource = await readFile(path.join(routesDir, 'documents.ts'), 'utf8');
    const documentsPublicRoutesSource = await readFile(
      path.join(routesDir, 'documents/publicRoutes.ts'),
      'utf8',
    );
    const documentsVersionRoutesSource = await readFile(
      path.join(routesDir, 'documents/versionRoutes.ts'),
      'utf8',
    );
    const documentsFileAccessRoutesSource = await readFile(
      path.join(routesDir, 'documents/fileAccessRoutes.ts'),
      'utf8',
    );
    const documentsClassificationRoutesSource = await readFile(
      path.join(routesDir, 'documents/classificationRoutes.ts'),
      'utf8',
    );
    const claimsSource = await readFile(path.join(routesDir, 'claims.ts'), 'utf8');
    const claimsWorkflowRoutesSource = await readFile(
      path.join(routesDir, 'claims/workflowRoutes.ts'),
      'utf8',
    );
    const holdpointsSource = await readFile(path.join(routesDir, 'holdpoints.ts'), 'utf8');
    const mfaSource = await readFile(path.join(routesDir, 'mfa.ts'), 'utf8');
    const subcontractorsSource = await readFile(path.join(routesDir, 'subcontractors.ts'), 'utf8');
    const subcontractorInvitationRoutesSource = await readFile(
      path.join(routesDir, 'subcontractors/invitationRoutes.ts'),
      'utf8',
    );
    const subcontractorAdminRoutesSource = await readFile(
      path.join(routesDir, 'subcontractors/adminRoutes.ts'),
      'utf8',
    );
    const subcontractorPortalAccessRoutesSource = await readFile(
      path.join(routesDir, 'subcontractors/portalAccessRoutes.ts'),
      'utf8',
    );
    const webhooksSource = await readFile(path.join(routesDir, 'webhooks.ts'), 'utf8');
    const serverSource = await readFile(serverPath, 'utf8');

    const authRouteDescriptors = routeCalls(authSource).map((route) => route.descriptor);
    const changePasswordIndex = authRouteDescriptors.indexOf('POST /change-password');
    expect(changePasswordIndex).toBeGreaterThan(-1);
    expect([
      ...extractedRegistrationRouteDescriptors(registrationRoutesSource),
      ...authRouteDescriptors.slice(0, changePasswordIndex),
      ...extractedProfileRouteDescriptors(profileRoutesSource),
      ...authRouteDescriptors.slice(changePasswordIndex),
    ]).toEqual([
      'POST /register',
      'POST /register-and-accept-invitation',
      'POST /login',
      'POST /magic-link/request',
      'POST /magic-link/verify',
      'GET /me',
      'POST /logout',
      'POST /logout-all-devices',
      'PATCH /profile',
      'POST /avatar',
      'DELETE /avatar',
      'POST /change-password',
      'POST /verify-email',
      'GET /verify-email-status',
      'POST /resend-verification',
      'POST /test-expired-token',
      'GET /export-data',
      'DELETE /delete-account',
    ]);
    expect(authSource.indexOf('createRegistrationRouter({')).toBeLessThan(
      authSource.indexOf("'/login'"),
    );
    expect(extractedRegistrationRouteDescriptors(registrationRoutesSource)).toEqual([
      'POST /register',
      'POST /register-and-accept-invitation',
    ]);
    expect(routeSourceForDescriptor(registrationRoutesSource, 'POST /register')).toContain(
      'AuditAction.USER_REGISTERED',
    );
    expect(routeSourceForDescriptor(registrationRoutesSource, 'POST /register')).toContain(
      'AuditAction.USER_EMAIL_VERIFIED',
    );
    expect(routeSourceForDescriptor(registrationRoutesSource, 'POST /register')).toContain(
      'sendVerificationEmail',
    );
    expect(routeSourceForDescriptor(registrationRoutesSource, 'POST /register')).toContain(
      'domain_allowlist',
    );
    expect(
      routeSourceForDescriptor(registrationRoutesSource, 'POST /register-and-accept-invitation'),
    ).toContain('prisma.$transaction');
    expect(
      routeSourceForDescriptor(registrationRoutesSource, 'POST /register-and-accept-invitation'),
    ).toContain('isSubcontractorInvitationExpired');
    expect(
      routeSourceForDescriptor(registrationRoutesSource, 'POST /register-and-accept-invitation'),
    ).toContain('Account created and invitation accepted successfully');
    expect(routeSourceForDescriptor(authSource, 'GET /me')).toContain('verifyToken(token)');
    expect(routeSourceForDescriptor(authSource, 'POST /logout-all-devices')).toContain(
      'verifyToken(token)',
    );
    expect(authSource.indexOf('createPasswordResetRouter({')).toBeGreaterThan(
      authSource.indexOf("'/logout-all-devices'"),
    );
    expect(authSource.indexOf('createPasswordResetRouter({')).toBeLessThan(
      authSource.indexOf('createProfileRouter({'),
    );
    expect(authSource.indexOf('createProfileRouter({')).toBeLessThan(
      authSource.indexOf("'/change-password'"),
    );
    expect(extractedPasswordResetRouteDescriptors(passwordResetRoutesSource)).toEqual([
      'POST /forgot-password',
      'POST /reset-password',
      'GET /validate-reset-token',
    ]);
    expect(passwordResetRoutesSource).toContain('genericResetTokenValidationMessage');
    expect(passwordResetRoutesSource).toContain('isMagicLinkToken(normalizedToken)');
    expect(passwordResetRoutesSource).toContain('AuditAction.PASSWORD_RESET_REQUESTED');
    expect(passwordResetRoutesSource).toContain('AuditAction.PASSWORD_CHANGED');
    expect(extractedProfileRouteDescriptors(profileRoutesSource)).toEqual([
      'PATCH /profile',
      'POST /avatar',
      'DELETE /avatar',
    ]);
    expect(routeSourceForDescriptor(profileRoutesSource, 'PATCH /profile')).toContain(
      'requireJwtAuth',
    );
    expect(routeSourceForDescriptor(profileRoutesSource, 'POST /avatar')).toContain(
      'requireJwtAuth',
    );
    expect(routeSourceForDescriptor(profileRoutesSource, 'DELETE /avatar')).toContain(
      'requireJwtAuth',
    );
    expect(profileRoutesSource).toContain("avatarUpload.single('avatar')");
    expect(profileRoutesSource).toContain('cleanupUploadedAvatar(uploadedFile)');
    expect(profileRoutesSource).toContain(
      'cleanupStoredAvatarUpload(avatarUrl, uploadedFile, userData.id)',
    );
    expect(profileRoutesSource).toContain('removeStoredAvatar(oldUser.avatarUrl, userData.id)');
    expect(profileRoutesSource).toContain('removeStoredAvatar(user.avatarUrl, userData.id)');
    expect(profileRoutesSource).toContain('isSupabaseConfigured() && uploadedFile.buffer');
    expect(profileRoutesSource).toContain('AuditAction.USER_PROFILE_UPDATED');
    expect(profileRoutesSource).toContain('AuditAction.USER_AVATAR_UPDATED');
    expect(profileRoutesSource).toContain('AuditAction.USER_AVATAR_REMOVED');
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

    expect(publicRouteDescriptorsBeforeRouteWideAuth(documentsSource)).toEqual([]);
    expect(documentsSource.indexOf('createDocumentPublicRouter({')).toBeLessThan(
      documentsSource.indexOf('router.use(requireAuth)'),
    );
    expect(extractedDocumentPublicRouteDescriptors(documentsPublicRoutesSource)).toEqual([
      'GET /download/:documentId',
      'GET /signed-url/validate',
    ]);
    expect(documentsSource.indexOf('createDocumentVersionRouter({')).toBeGreaterThan(
      documentsSource.indexOf('router.use(requireAuth)'),
    );
    expect(documentsSource.indexOf('createDocumentVersionRouter({')).toBeLessThan(
      documentsSource.indexOf('createDocumentFileAccessRouter({'),
    );
    expect(extractedDocumentVersionRouteDescriptors(documentsVersionRoutesSource)).toEqual([
      'POST /:documentId/version',
      'GET /:documentId/versions',
    ]);
    expect(documentsSource.indexOf('createDocumentFileAccessRouter({')).toBeLessThan(
      documentsSource.indexOf('// DELETE /api/documents/:documentId'),
    );
    expect(extractedDocumentFileAccessRouteDescriptors(documentsFileAccessRoutesSource)).toEqual([
      'GET /file/:documentId',
      'POST /:documentId/signed-url',
    ]);
    expect(documentsSource.indexOf('createDocumentClassificationRouter({')).toBeGreaterThan(
      documentsSource.indexOf('// DELETE /api/documents/:documentId'),
    );
    expect(
      extractedDocumentClassificationRouteDescriptors(documentsClassificationRoutesSource),
    ).toEqual([
      'POST /:documentId/classify',
      'POST /:documentId/save-classification',
      'PATCH /:documentId',
    ]);

    expect(claimsSource.indexOf('router.use(requireAuth)')).toBeLessThan(
      claimsSource.indexOf('createClaimWorkflowRouter({'),
    );
    expect(claimsSource.indexOf('createClaimWorkflowRouter({')).toBeLessThan(
      claimsSource.indexOf('createClaimEvidenceRouter({'),
    );
    expect(claimsSource.indexOf('createClaimEvidenceRouter({')).toBeLessThan(
      claimsSource.indexOf('createClaimPostEvidenceWorkflowRouter({'),
    );
    expect(extractedClaimWorkflowRouteDescriptors(claimsWorkflowRoutesSource)).toEqual([
      'POST /:projectId/claims',
      'PUT /:projectId/claims/:claimId',
      'POST /:projectId/claims/:claimId/certify',
      'POST /:projectId/claims/:claimId/payment',
      'DELETE /:projectId/claims/:claimId',
    ]);

    expect(publicRouteDescriptorsBeforeRouteWideAuth(holdpointsSource)).toEqual([
      'GET /public/:token',
      'POST /public/:token/release',
    ]);

    expect(unprotectedRouteDescriptors(mfaSource)).toEqual(['POST /verify']);
    expect(mfaSource).toContain('authRateLimiter');
    expect(mfaSource).toContain('isLockedOut(clientIp, normalizedUserId)');
    expect(mfaSource).toContain('recordFailedAuthAttempt(clientIp, normalizedUserId)');
    expect(mfaSource).toContain('clearFailedAuthAttempts(clientIp, normalizedUserId)');

    expect(publicRouteDescriptorsBeforeRouteWideAuth(subcontractorsSource)).toEqual([]);
    expect(
      subcontractorsSource.indexOf('subcontractorInvitationRouters.publicRouter'),
    ).toBeLessThan(subcontractorsSource.indexOf('subcontractorsRouter.use(requireAuth)'));
    expect(
      subcontractorsSource.indexOf('subcontractorInvitationRouters.authenticatedRouter'),
    ).toBeGreaterThan(subcontractorsSource.indexOf('subcontractorsRouter.use(requireAuth)'));
    expect(
      subcontractorsSource.indexOf('subcontractorInvitationRouters.authenticatedRouter'),
    ).toBeLessThan(subcontractorsSource.indexOf('createSubcontractorAdminRouter({'));
    expect(subcontractorsSource.indexOf('createSubcontractorAdminRouter({')).toBeGreaterThan(
      subcontractorsSource.indexOf('createSubcontractorMyCompanyRouter({'),
    );
    expect(subcontractorsSource.indexOf('createSubcontractorAdminRouter({')).toBeLessThan(
      subcontractorsSource.indexOf('createSubcontractorPortalAccessRouter({'),
    );
    expect(subcontractorsSource.indexOf('createSubcontractorPortalAccessRouter({')).toBeLessThan(
      subcontractorsSource.indexOf("'/project/:projectId'"),
    );
    expect(
      extractedSubcontractorInvitationPublicRouteDescriptors(subcontractorInvitationRoutesSource),
    ).toEqual(['GET /invitation/:id']);
    expect(
      extractedSubcontractorInvitationAuthenticatedRouteDescriptors(
        subcontractorInvitationRoutesSource,
      ),
    ).toEqual([
      'GET /my-pending-invitation',
      'POST /invite',
      'GET /for-project/:projectId',
      'POST /invitation/:id/accept',
    ]);
    expect(extractedSubcontractorAdminRouteDescriptors(subcontractorAdminRoutesSource)).toEqual([
      'PATCH /:id/status',
      'DELETE /:id',
    ]);
    expect(
      extractedSubcontractorPortalAccessRouteDescriptors(subcontractorPortalAccessRoutesSource),
    ).toEqual(['PATCH /:id/portal-access', 'GET /:id/portal-access']);

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

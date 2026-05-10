import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { generateToken } from '../lib/auth.js';
import crypto from 'crypto';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { getFrontendUrl, getGoogleRedirectUri } from '../lib/runtimeConfig.js';
import { fetchWithTimeout } from '../lib/fetchWithTimeout.js';
import { logError, logWarn } from '../lib/serverLogger.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';

export const oauthRouter = Router();

// ============================================================================
// Database-backed OAuth State Storage
// State values are hashed at rest and stored through Prisma-managed migrations.
// ============================================================================

const OAUTH_STATE_EXPIRY_MS = 10 * 60 * 1000;
const OAUTH_CALLBACK_CODE_EXPIRY_MS = 2 * 60 * 1000;
const OAUTH_STATE_CLEANUP_MS = 5 * 60 * 1000;
const EMAIL_MAX_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hashOAuthState(state: string): string {
  const salt = process.env.OAUTH_STATE_SALT || process.env.JWT_SECRET || '';
  return crypto.createHash('sha256').update(`${state}:${salt}`).digest('hex');
}

function hashOAuthCallbackCode(code: string): string {
  const salt = process.env.OAUTH_CALLBACK_CODE_SALT || process.env.JWT_SECRET || '';
  return crypto.createHash('sha256').update(`${code}:${salt}`).digest('hex');
}

function isMockOAuthEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.ALLOW_MOCK_OAUTH === 'true';
}

function normalizeOAuthEmail(email: string): string {
  const normalizedEmail = email.trim().toLowerCase();

  if (
    !normalizedEmail ||
    normalizedEmail.length > EMAIL_MAX_LENGTH ||
    !EMAIL_PATTERN.test(normalizedEmail)
  ) {
    throw AppError.badRequest('Invalid email address');
  }

  return normalizedEmail;
}

/**
 * Create a new OAuth state token in the database
 * @param redirectUri Optional redirect URI to store with the state
 * @returns The generated state token
 */
async function createOAuthState(redirectUri?: string): Promise<string> {
  const state = crypto.randomBytes(32).toString('hex');

  await prisma.oauthState.create({
    data: {
      stateHash: hashOAuthState(state),
      redirectUri: redirectUri || null,
      expiresAt: new Date(Date.now() + OAUTH_STATE_EXPIRY_MS),
    },
  });

  return state;
}

/**
 * Verify and consume an OAuth state token
 * @param state The state token to verify
 * @returns The stored redirect URI if valid, null if invalid or expired
 */
async function verifyOAuthState(state: string): Promise<{ valid: boolean; redirectUri?: string }> {
  await cleanupExpiredStates();

  const record = await prisma.oauthState.findUnique({
    where: { stateHash: hashOAuthState(state) },
  });

  if (!record) {
    return { valid: false };
  }

  if (record.expiresAt < new Date()) {
    await prisma.oauthState.delete({ where: { id: record.id } });
    return { valid: false };
  }

  await prisma.oauthState.delete({ where: { id: record.id } });

  return {
    valid: true,
    redirectUri: record.redirectUri || undefined,
  };
}

/**
 * Clean up expired OAuth states from the database
 */
async function cleanupExpiredStates(): Promise<void> {
  const now = new Date();
  await Promise.all([
    prisma.oauthState.deleteMany({
      where: { expiresAt: { lt: now } },
    }),
    prisma.oauthCallbackCode.deleteMany({
      where: { expiresAt: { lt: now } },
    }),
  ]);
}

async function createOAuthCallbackCode(userId: string, provider: string): Promise<string> {
  const code = crypto.randomBytes(32).toString('hex');

  await prisma.oauthCallbackCode.create({
    data: {
      codeHash: hashOAuthCallbackCode(code),
      userId,
      provider,
      expiresAt: new Date(Date.now() + OAUTH_CALLBACK_CODE_EXPIRY_MS),
    },
  });

  return code;
}

async function consumeOAuthCallbackCode(
  code: string,
): Promise<{ userId: string; provider: string } | null> {
  await cleanupExpiredStates();

  const now = new Date();
  const rows = await prisma.$queryRaw<Array<{ user_id: string; provider: string }>>`
    DELETE FROM "oauth_callback_codes"
    WHERE "code_hash" = ${hashOAuthCallbackCode(code)}
      AND "expires_at" > ${now}
    RETURNING "user_id", "provider";
  `;

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    userId: row.user_id,
    provider: row.provider,
  };
}

// Schedule periodic cleanup every 5 minutes
setInterval(() => {
  cleanupExpiredStates().catch((err) => {
    logError('[OAuth] Failed to cleanup expired states:', err);
  });
}, OAUTH_STATE_CLEANUP_MS).unref?.();

function getMfaRequiredError() {
  return AppError.forbidden(
    'MFA verification required. Sign in with email and password to complete MFA.',
  );
}

function formatOAuthProviderStatus(response: Response): string {
  const status =
    typeof response.status === 'number' && response.status > 0
      ? String(response.status)
      : 'unknown';
  const statusText = typeof response.statusText === 'string' ? response.statusText.trim() : '';

  return statusText ? `${status} ${statusText}` : status;
}

function parseOAuthCallbackQueryParam(value: unknown): string | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized || undefined;
}

// GET /api/auth/google - Initiate Google OAuth flow
oauthRouter.get(
  '/google',
  asyncHandler(async (_req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const frontendUrl = getFrontendUrl();
    const redirectUri = getGoogleRedirectUri();

    if (!clientId || clientId === 'mock-google-client-id.apps.googleusercontent.com') {
      if (!isMockOAuthEnabled()) {
        return res.redirect(`${frontendUrl}/login?error=oauth_not_configured`);
      }

      // Development mode: Redirect to a mock OAuth flow
      // Generate a state token for security (using database storage)
      const state = await createOAuthState();

      // Redirect to our mock callback with a test user
      return res.redirect(`${frontendUrl}/auth/oauth-mock?provider=google&state=${state}`);
    }

    // Production mode: Redirect to actual Google OAuth
    const state = await createOAuthState();

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state: state,
      access_type: 'offline',
      prompt: 'consent',
    });

    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  }),
);

// GET /api/auth/google/callback - Handle Google OAuth callback
oauthRouter.get(
  '/google/callback',
  asyncHandler(async (req, res) => {
    const frontendUrl = getFrontendUrl();
    const code = parseOAuthCallbackQueryParam(req.query.code);
    const state = parseOAuthCallbackQueryParam(req.query.state);
    const error = parseOAuthCallbackQueryParam(req.query.error);

    if (error === null) {
      logWarn('[OAuth] Malformed OAuth error callback parameter');
      return res.redirect(`${frontendUrl}/login?error=oauth_failed`);
    }

    if (state === null) {
      logWarn('[OAuth] Malformed OAuth state callback parameter');
      return res.redirect(`${frontendUrl}/login?error=invalid_state`);
    }

    if (code === null) {
      logWarn('[OAuth] Malformed OAuth authorization code callback parameter');
      return res.redirect(`${frontendUrl}/login?error=no_code`);
    }

    // Handle OAuth errors
    if (error) {
      logWarn('[OAuth] Google OAuth error:', error);
      return res.redirect(
        `${frontendUrl}/login?error=oauth_failed&message=${encodeURIComponent(error)}`,
      );
    }

    // Verify state token using database storage
    if (!state) {
      logWarn('[OAuth] No state token provided');
      return res.redirect(`${frontendUrl}/login?error=invalid_state`);
    }

    const stateVerification = await verifyOAuthState(state);
    if (!stateVerification.valid) {
      logWarn('[OAuth] Invalid or expired state token');
      return res.redirect(`${frontendUrl}/login?error=invalid_state`);
    }

    if (!code) {
      logWarn('[OAuth] No authorization code received');
      return res.redirect(`${frontendUrl}/login?error=no_code`);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = getGoogleRedirectUri();

    if (process.env.NODE_ENV === 'production' && (!clientId || !clientSecret)) {
      return res.redirect(`${frontendUrl}/login?error=oauth_not_configured`);
    }

    // Exchange code for tokens
    const tokenResponse = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      logWarn(
        `[OAuth] Token exchange failed with status ${formatOAuthProviderStatus(tokenResponse)}`,
      );
      return res.redirect(`${frontendUrl}/login?error=token_exchange_failed`);
    }

    const tokens = (await tokenResponse.json()) as { access_token: string; id_token?: string };

    // Get user info from Google
    const userInfoResponse = await fetchWithTimeout(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      },
    );

    if (!userInfoResponse.ok) {
      logWarn('[OAuth] Failed to get user info');
      return res.redirect(`${frontendUrl}/login?error=user_info_failed`);
    }

    const googleUser = (await userInfoResponse.json()) as {
      id: string;
      email: string;
      name?: string;
      picture?: string;
      verified_email?: boolean;
    };

    // Find or create user, then hand off a one-time code instead of putting the JWT in the URL.
    const { user, mfaEnabled } = await findOrCreateOAuthUser({
      provider: 'google',
      providerId: googleUser.id,
      email: googleUser.email,
      fullName: googleUser.name,
      avatarUrl: googleUser.picture,
      emailVerified: googleUser.verified_email ?? true,
    });

    if (mfaEnabled) {
      return res.redirect(`${frontendUrl}/login?error=mfa_required`);
    }

    const callbackCode = await createOAuthCallbackCode(user.id, 'google');
    res.redirect(`${frontendUrl}/auth/oauth-callback?code=${callbackCode}&provider=google`);
  }),
);

interface GoogleCredentialPayload {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
  email_verified?: boolean | string;
  aud?: string;
  iss?: string;
  exp?: number | string;
}

function decodeJwtPayload(credential: string): GoogleCredentialPayload {
  const parts = credential.split('.');
  if (parts.length !== 3) {
    throw AppError.badRequest('Invalid credential format');
  }

  try {
    const normalizedPayload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      '=',
    );
    return JSON.parse(
      Buffer.from(paddedPayload, 'base64').toString('utf8'),
    ) as GoogleCredentialPayload;
  } catch {
    throw AppError.badRequest('Invalid credential payload');
  }
}

async function verifyProductionGoogleCredential(
  credential: string,
): Promise<GoogleCredentialPayload> {
  const response = await fetchWithTimeout(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
  );

  if (!response.ok) {
    logWarn(
      `[OAuth] Google token verification failed with status ${formatOAuthProviderStatus(response)}`,
    );
    throw AppError.unauthorized('Invalid Google credential');
  }

  return (await response.json()) as GoogleCredentialPayload;
}

function isVerifiedEmail(value: boolean | string | undefined): boolean {
  return value === true || value === 'true';
}

function validateGoogleCredentialPayload(
  payload: GoogleCredentialPayload,
  clientId?: string,
): Required<Pick<GoogleCredentialPayload, 'sub' | 'email'>> & GoogleCredentialPayload {
  const expectedClientId = process.env.GOOGLE_CLIENT_ID;

  if (process.env.NODE_ENV === 'production' && !expectedClientId) {
    throw AppError.internal('Google OAuth is not configured');
  }

  if (payload.aud !== expectedClientId && payload.aud !== clientId) {
    logWarn('[OAuth] Client ID mismatch:', payload.aud, 'vs', expectedClientId);
    if (process.env.NODE_ENV === 'production') {
      throw AppError.badRequest('Invalid client ID');
    }
  }

  if (
    process.env.NODE_ENV === 'production' &&
    payload.iss &&
    !['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss)
  ) {
    throw AppError.unauthorized('Invalid Google token issuer');
  }

  if (payload.exp && Number(payload.exp) * 1000 <= Date.now()) {
    throw AppError.unauthorized('Google credential has expired');
  }

  if (!payload.sub || !payload.email) {
    throw AppError.badRequest('Google credential is missing required profile fields');
  }

  if (!isVerifiedEmail(payload.email_verified)) {
    throw AppError.badRequest('Google account email is not verified');
  }

  return payload as Required<Pick<GoogleCredentialPayload, 'sub' | 'email'>> &
    GoogleCredentialPayload;
}

async function getGoogleCredentialPayload(credential: string, clientId?: string) {
  const payload =
    process.env.NODE_ENV === 'production'
      ? await verifyProductionGoogleCredential(credential)
      : decodeJwtPayload(credential);

  return validateGoogleCredentialPayload(payload, clientId);
}

// POST /api/auth/google/token - Exchange Google ID token for app token (for frontend SDK)
oauthRouter.post(
  '/google/token',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const { credential, clientId } = req.body;

    if (!credential) {
      throw AppError.badRequest('Google credential is required');
    }

    const payload = await getGoogleCredentialPayload(
      String(credential),
      typeof clientId === 'string' ? clientId : undefined,
    );

    // Extract user info from the token
    const googleUser = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      verified_email: isVerifiedEmail(payload.email_verified),
    };

    // Find or create user
    const { user, token, mfaEnabled } = await findOrCreateOAuthUser({
      provider: 'google',
      providerId: googleUser.id,
      email: googleUser.email,
      fullName: googleUser.name,
      avatarUrl: googleUser.picture,
      emailVerified: googleUser.verified_email ?? true,
    });

    if (mfaEnabled || !token) {
      throw getMfaRequiredError();
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        companyId: user.companyId,
        companyName: user.companyName,
        avatarUrl: user.avatarUrl,
      },
      token,
    });
  }),
);

// POST /api/auth/oauth/exchange - Exchange one-time OAuth callback code for app token
oauthRouter.post(
  '/oauth/exchange',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      throw AppError.badRequest('OAuth callback code is required');
    }

    const consumed = await consumeOAuthCallbackCode(code);
    if (!consumed) {
      throw AppError.badRequest('Invalid or expired OAuth callback code');
    }

    const user = await prisma.user.findUnique({
      where: { id: consumed.userId },
      include: {
        company: { select: { name: true } },
      },
    });

    if (!user) {
      throw AppError.unauthorized('OAuth user no longer exists');
    }

    if (user.twoFactorEnabled) {
      throw getMfaRequiredError();
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.roleInCompany,
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.roleInCompany,
        companyId: user.companyId,
        companyName: user.company?.name || null,
        avatarUrl: user.avatarUrl,
      },
      token,
      provider: consumed.provider,
    });
  }),
);

// POST /api/auth/oauth/mock - Development mock OAuth (simulates successful OAuth)
oauthRouter.post(
  '/oauth/mock',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    if (!isMockOAuthEnabled()) {
      throw AppError.notFound('Resource');
    }

    const { provider, email, name } = req.body;

    if (!email) {
      throw AppError.badRequest('Email is required for mock OAuth');
    }

    // Create a mock user
    const mockProviderId = `mock_${provider}_${Date.now()}`;

    const { user, token, mfaEnabled } = await findOrCreateOAuthUser({
      provider: provider || 'google',
      providerId: mockProviderId,
      email,
      fullName: name || email.split('@')[0],
      emailVerified: true,
    });

    if (mfaEnabled || !token) {
      throw getMfaRequiredError();
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        companyId: user.companyId,
        companyName: user.companyName,
      },
      token,
    });
  }),
);

// Helper function to find or create an OAuth user
async function findOrCreateOAuthUser(params: {
  provider: string;
  providerId: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  emailVerified?: boolean;
}) {
  const { provider, providerId, email, fullName, avatarUrl, emailVerified = true } = params;
  const normalizedEmail = normalizeOAuthEmail(email);

  // First, try to find user by email
  let user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      company: { select: { name: true } },
    },
  });

  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        oauthProvider: provider,
        oauthProviderId: providerId,
        avatarUrl: avatarUrl ?? undefined,
        emailVerified: !user.emailVerified && emailVerified ? true : undefined,
        emailVerifiedAt: !user.emailVerified && emailVerified ? new Date() : undefined,
      },
      include: {
        company: { select: { name: true } },
      },
    });
  } else {
    // Create new user
    user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        fullName: fullName || normalizedEmail.split('@')[0],
        emailVerified,
        emailVerifiedAt: emailVerified ? new Date() : null,
        avatarUrl,
        oauthProvider: provider,
        oauthProviderId: providerId,
      },
      include: {
        company: { select: { name: true } },
      },
    });
  }

  const token = user.twoFactorEnabled
    ? null
    : generateToken({
        userId: user.id,
        email: user.email,
        role: user.roleInCompany,
      });

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.roleInCompany,
      companyId: user.companyId,
      companyName: user.company?.name || null,
      avatarUrl: user.avatarUrl,
    },
    token,
    mfaEnabled: user.twoFactorEnabled,
  };
}

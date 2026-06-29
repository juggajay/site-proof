import { Router, type Request } from 'express';
import { prisma } from '../lib/prisma.js';
import { generateToken } from '../lib/auth.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { getFrontendUrl, getGoogleRedirectUri } from '../lib/runtimeConfig.js';
import { fetchWithTimeout } from '../lib/fetchWithTimeout.js';
import { logWarn } from '../lib/serverLogger.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import {
  buildGoogleOAuthLoginResponse,
  buildMockOAuthLoginResponse,
  buildOAuthExchangeResponse,
} from './oauth/responses.js';
import { auditOAuthLogin, auditOAuthRegistration } from './oauth/audit.js';
import {
  decodeJwtPayload,
  formatOAuthProviderStatus,
  getMfaRequiredError,
  isMockOAuthEnabled,
  isVerifiedEmail,
  normalizeOAuthEmail,
  parseOAuthCallbackQueryParam,
  type GoogleCredentialPayload,
} from './oauth/helpers.js';
import {
  consumeOAuthCallbackCode,
  createOAuthCallbackCode,
  createOAuthState,
  verifyOAuthState,
} from './oauth/stateStore.js';

export const oauthRouter = Router();

function normalizeOAuthAppRedirect(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return null;
  }

  try {
    const parsed = new URL(trimmed, 'https://siteproof.local');
    if (parsed.origin !== 'https://siteproof.local') return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

function appendRedirectParam(url: string, redirect: string | undefined): string {
  if (!redirect) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}redirect=${encodeURIComponent(redirect)}`;
}

// GET /api/auth/google - Initiate Google OAuth flow
oauthRouter.get(
  '/google',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const frontendUrl = getFrontendUrl();
    const redirectUri = getGoogleRedirectUri();
    const appRedirect = normalizeOAuthAppRedirect(req.query.redirect);

    if (!clientId || clientId === 'mock-google-client-id.apps.googleusercontent.com') {
      if (!isMockOAuthEnabled()) {
        return res.redirect(`${frontendUrl}/login?error=oauth_not_configured`);
      }

      // Development mode: Redirect to a mock OAuth flow
      // Generate a state token for security (using database storage)
      const state = await createOAuthState(appRedirect ?? undefined);

      // Redirect to our mock callback with a test user
      return res.redirect(`${frontendUrl}/auth/oauth-mock?provider=google&state=${state}`);
    }

    // Production mode: Redirect to actual Google OAuth
    const state = await createOAuthState(appRedirect ?? undefined);

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
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const frontendUrl = getFrontendUrl();
    const callbackParams = parseGoogleCallbackRequest(req.query);
    if ('redirect' in callbackParams) {
      return res.redirect(buildOAuthLoginRedirect(frontendUrl, callbackParams.redirect));
    }

    const stateVerification = await verifyOAuthState(callbackParams.state);
    if (!stateVerification.valid) {
      logWarn('[OAuth] Invalid or expired state token');
      return res.redirect(`${frontendUrl}/login?error=invalid_state`);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = getGoogleRedirectUri();

    if (process.env.NODE_ENV === 'production' && (!clientId || !clientSecret)) {
      return res.redirect(`${frontendUrl}/login?error=oauth_not_configured`);
    }

    const tokens = await exchangeGoogleCodeForTokens({
      code: callbackParams.code,
      clientId: clientId!,
      clientSecret: clientSecret!,
      redirectUri,
    });
    if (!tokens) {
      return res.redirect(`${frontendUrl}/login?error=token_exchange_failed`);
    }

    const verifiedIdentity = await getVerifiedGoogleCallbackIdentity(tokens.id_token);
    if (!verifiedIdentity) {
      return res.redirect(`${frontendUrl}/login?error=invalid_google_token`);
    }

    const googleUser = await getGoogleCallbackUserInfo(tokens.access_token);
    if (!googleUser) {
      return res.redirect(`${frontendUrl}/login?error=user_info_failed`);
    }

    if (!isVerifiedEmail(googleUser.verified_email)) {
      logWarn('[OAuth] Google callback email is not verified');
      return res.redirect(`${frontendUrl}/login?error=email_not_verified`);
    }

    if (!doesGoogleCallbackUserInfoMatchIdentity(googleUser, verifiedIdentity)) {
      return res.redirect(`${frontendUrl}/login?error=invalid_google_token`);
    }

    // Find or create user, then hand off a one-time code instead of putting the JWT in the URL.
    const { user, mfaEnabled, created } = await findOrCreateOAuthUser({
      provider: 'google',
      providerId: verifiedIdentity.providerId,
      email: verifiedIdentity.email,
      fullName: googleUser.name ?? verifiedIdentity.name,
      avatarUrl: googleUser.picture ?? verifiedIdentity.picture,
      emailVerified: true,
    });

    if (created) {
      await auditOAuthRegistration(req, user.id, 'google', 'oauth_callback', true);
    }

    if (mfaEnabled) {
      return res.redirect(
        appendRedirectParam(
          `${frontendUrl}/login?error=mfa_required`,
          stateVerification.redirectUri,
        ),
      );
    }

    const callbackCode = await createOAuthCallbackCode(user.id, 'google');
    const frontendCallbackParams = new URLSearchParams({ code: callbackCode, provider: 'google' });
    if (stateVerification.redirectUri) {
      frontendCallbackParams.set('redirect', stateVerification.redirectUri);
    }
    res.redirect(`${frontendUrl}/auth/oauth-callback?${frontendCallbackParams.toString()}`);
  }),
);

type OAuthLoginRedirect = {
  error: string;
  message?: string;
};

type GoogleCallbackRequest = { code: string; state: string } | { redirect: OAuthLoginRedirect };

type GoogleTokenResponse = {
  access_token: string;
  id_token?: string;
};

type GoogleCallbackUserInfo = {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  verified_email?: boolean;
};

type VerifiedGoogleCallbackIdentity = {
  providerId: string;
  email: string;
  name?: string;
  picture?: string;
};

function buildOAuthLoginRedirect(frontendUrl: string, redirect: OAuthLoginRedirect): string {
  const params = new URLSearchParams({ error: redirect.error });
  if (redirect.message) {
    params.set('message', redirect.message);
  }
  return `${frontendUrl}/login?${params.toString()}`;
}

function parseGoogleCallbackRequest(query: Request['query']): GoogleCallbackRequest {
  const code = parseOAuthCallbackQueryParam(query.code);
  const state = parseOAuthCallbackQueryParam(query.state);
  const error = parseOAuthCallbackQueryParam(query.error);

  if (error === null) {
    logWarn('[OAuth] Malformed OAuth error callback parameter');
    return { redirect: { error: 'oauth_failed' } } satisfies GoogleCallbackRequest;
  }

  if (state === null) {
    logWarn('[OAuth] Malformed OAuth state callback parameter');
    return { redirect: { error: 'invalid_state' } } satisfies GoogleCallbackRequest;
  }

  if (code === null) {
    logWarn('[OAuth] Malformed OAuth authorization code callback parameter');
    return { redirect: { error: 'no_code' } } satisfies GoogleCallbackRequest;
  }

  if (error) {
    logWarn('[OAuth] Google OAuth error:', error);
    return { redirect: { error: 'oauth_failed', message: error } } satisfies GoogleCallbackRequest;
  }

  if (!state) {
    logWarn('[OAuth] No state token provided');
    return { redirect: { error: 'invalid_state' } } satisfies GoogleCallbackRequest;
  }

  if (!code) {
    logWarn('[OAuth] No authorization code received');
    return { redirect: { error: 'no_code' } } satisfies GoogleCallbackRequest;
  }

  return { code, state } satisfies GoogleCallbackRequest;
}

async function exchangeGoogleCodeForTokens(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<GoogleTokenResponse | null> {
  const tokenResponse = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: params.code,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) {
    logWarn(
      `[OAuth] Token exchange failed with status ${formatOAuthProviderStatus(tokenResponse)}`,
    );
    return null;
  }

  return (await tokenResponse.json()) as GoogleTokenResponse;
}

async function getGoogleCallbackUserInfo(
  accessToken: string,
): Promise<GoogleCallbackUserInfo | null> {
  const userInfoResponse = await fetchWithTimeout('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!userInfoResponse.ok) {
    logWarn('[OAuth] Failed to get user info');
    return null;
  }

  return (await userInfoResponse.json()) as GoogleCallbackUserInfo;
}

async function getVerifiedGoogleCallbackIdentity(
  idToken: string | undefined,
): Promise<VerifiedGoogleCallbackIdentity | null> {
  if (!idToken || typeof idToken !== 'string') {
    logWarn('[OAuth] Google token response did not include an ID token');
    return null;
  }

  let payload: Awaited<ReturnType<typeof getGoogleCredentialPayload>>;
  try {
    payload = await getGoogleCredentialPayload(idToken);
  } catch {
    logWarn('[OAuth] Google callback ID token verification failed');
    return null;
  }

  try {
    return {
      providerId: payload.sub,
      email: normalizeOAuthEmail(payload.email),
      name: payload.name,
      picture: payload.picture,
    };
  } catch {
    logWarn('[OAuth] Google callback ID token email is invalid');
    return null;
  }
}

function doesGoogleCallbackUserInfoMatchIdentity(
  googleUser: GoogleCallbackUserInfo,
  verifiedIdentity: VerifiedGoogleCallbackIdentity,
): boolean {
  let userInfoEmail: string;
  try {
    userInfoEmail = normalizeOAuthEmail(googleUser.email);
  } catch {
    logWarn('[OAuth] Google callback userinfo email is invalid');
    return false;
  }

  if (googleUser.id !== verifiedIdentity.providerId || userInfoEmail !== verifiedIdentity.email) {
    logWarn('[OAuth] Google callback userinfo did not match verified ID token');
    return false;
  }

  return true;
}

async function verifyGoogleCredential(credential: string): Promise<GoogleCredentialPayload> {
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

function isTestGoogleCredentialFixtureEnabled(): boolean {
  return process.env.NODE_ENV === 'test' && process.env.ALLOW_TEST_GOOGLE_CREDENTIALS === 'true';
}

function validateGoogleCredentialPayload(
  payload: GoogleCredentialPayload,
): Required<Pick<GoogleCredentialPayload, 'sub' | 'email'>> & GoogleCredentialPayload {
  const expectedClientId = process.env.GOOGLE_CLIENT_ID?.trim();

  if (!expectedClientId) {
    throw AppError.internal('Google OAuth is not configured');
  }

  if (expectedClientId && payload.aud !== expectedClientId) {
    logWarn('[OAuth] Client ID mismatch:', payload.aud, 'vs', expectedClientId);
    throw AppError.badRequest('Invalid client ID');
  }

  if (
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

async function getGoogleCredentialPayload(credential: string) {
  const payload = isTestGoogleCredentialFixtureEnabled()
    ? decodeJwtPayload(credential)
    : await verifyGoogleCredential(credential);

  return validateGoogleCredentialPayload(payload);
}

// POST /api/auth/google/token - Exchange Google ID token for app token (for frontend SDK)
oauthRouter.post(
  '/google/token',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const { credential } = req.body;

    if (!credential) {
      throw AppError.badRequest('Google credential is required');
    }

    const payload = await getGoogleCredentialPayload(String(credential));

    // Extract user info from the token
    const googleUser = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      verified_email: isVerifiedEmail(payload.email_verified),
    };

    // Find or create user
    const { user, token, mfaEnabled, created } = await findOrCreateOAuthUser({
      provider: 'google',
      providerId: googleUser.id,
      email: googleUser.email,
      fullName: googleUser.name,
      avatarUrl: googleUser.picture,
      emailVerified: googleUser.verified_email,
    });

    if (mfaEnabled || !token) {
      throw getMfaRequiredError();
    }

    if (created) {
      await auditOAuthRegistration(
        req,
        user.id,
        'google',
        'google_identity',
        googleUser.verified_email,
      );
    }

    await auditOAuthLogin(req, user.id, 'google', 'google_identity');

    res.json(buildGoogleOAuthLoginResponse(user, token));
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

    await auditOAuthLogin(req, user.id, consumed.provider, 'oauth_callback');

    res.json(buildOAuthExchangeResponse(user, token, consumed.provider));
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

    const { user, token, mfaEnabled, created } = await findOrCreateOAuthUser({
      provider: provider || 'google',
      providerId: mockProviderId,
      email,
      fullName: name || email.split('@')[0],
      emailVerified: true,
    });

    if (mfaEnabled || !token) {
      throw getMfaRequiredError();
    }

    if (created) {
      await auditOAuthRegistration(req, user.id, provider || 'google', 'mock_oauth', true);
    }

    await auditOAuthLogin(req, user.id, provider || 'google', 'mock_oauth');

    res.json(buildMockOAuthLoginResponse(user, token));
  }),
);

// Helper function to find or create an OAuth user
async function findOrCreateOAuthUser(params: {
  provider: string;
  providerId: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  emailVerified: boolean;
}) {
  const { provider, providerId, email, fullName, avatarUrl, emailVerified } = params;
  const normalizedEmail = normalizeOAuthEmail(email);

  // First, try to find user by email
  let created = false;
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
    created = true;
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
    created,
  };
}

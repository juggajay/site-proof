import { Router } from 'express';
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

    if (!isVerifiedEmail(googleUser.verified_email)) {
      logWarn('[OAuth] Google callback email is not verified');
      return res.redirect(`${frontendUrl}/login?error=email_not_verified`);
    }

    // Find or create user, then hand off a one-time code instead of putting the JWT in the URL.
    const { user, mfaEnabled, created } = await findOrCreateOAuthUser({
      provider: 'google',
      providerId: googleUser.id,
      email: googleUser.email,
      fullName: googleUser.name,
      avatarUrl: googleUser.picture,
      emailVerified: true,
    });

    if (created) {
      await auditOAuthRegistration(req, user.id, 'google', 'oauth_callback', true);
    }

    if (mfaEnabled) {
      return res.redirect(`${frontendUrl}/login?error=mfa_required`);
    }

    const callbackCode = await createOAuthCallbackCode(user.id, 'google');
    res.redirect(`${frontendUrl}/auth/oauth-callback?code=${callbackCode}&provider=google`);
  }),
);

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

function validateGoogleCredentialPayload(
  payload: GoogleCredentialPayload,
): Required<Pick<GoogleCredentialPayload, 'sub' | 'email'>> & GoogleCredentialPayload {
  const expectedClientId = process.env.GOOGLE_CLIENT_ID;

  if (process.env.NODE_ENV === 'production' && !expectedClientId) {
    throw AppError.internal('Google OAuth is not configured');
  }

  if (expectedClientId && payload.aud !== expectedClientId) {
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

async function getGoogleCredentialPayload(credential: string) {
  const payload =
    process.env.NODE_ENV === 'production'
      ? await verifyProductionGoogleCredential(credential)
      : decodeJwtPayload(credential);

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

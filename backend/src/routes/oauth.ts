import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { generateToken } from '../lib/auth.js'
import crypto from 'crypto'

export const oauthRouter = Router()

// ============================================================================
// Database-backed OAuth State Storage
// Replaces in-memory Map for production reliability and multi-instance support
// ============================================================================

/**
 * Initialize the oauth_states table if it doesn't exist
 */
async function initOAuthStatesTable() {
  try {
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS oauth_states (
        id TEXT PRIMARY KEY,
        state TEXT UNIQUE NOT NULL,
        redirect_uri TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      )
    `
    // Create index for faster lookups
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON oauth_states(state)
    `
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at)
    `
  } catch (error) {
    console.error('[OAuth] Failed to initialize oauth_states table:', error)
  }
}

// Initialize table on module load
initOAuthStatesTable()

/**
 * Create a new OAuth state token in the database
 * @param redirectUri Optional redirect URI to store with the state
 * @returns The generated state token
 */
async function createOAuthState(redirectUri?: string): Promise<string> {
  const state = crypto.randomBytes(16).toString('hex')
  const id = crypto.randomUUID()

  await prisma.$executeRaw`
    INSERT INTO oauth_states (id, state, redirect_uri, expires_at)
    VALUES (${id}, ${state}, ${redirectUri || null}, NOW() + INTERVAL '10 minutes')
  `

  return state
}

/**
 * Verify and consume an OAuth state token
 * @param state The state token to verify
 * @returns The stored redirect URI if valid, null if invalid or expired
 */
async function verifyOAuthState(state: string): Promise<{ valid: boolean; redirectUri?: string }> {
  // Clean up expired states first
  await cleanupExpiredStates()

  // Find the state record
  const results = await prisma.$queryRaw<Array<{ id: string; redirect_uri: string | null; expires_at: string }>>`
    SELECT id, redirect_uri, expires_at FROM oauth_states
    WHERE state = ${state}
  `

  if (!results || results.length === 0) {
    return { valid: false }
  }

  const record = results[0]
  const expiresAt = new Date(record.expires_at)

  // Check if expired
  if (expiresAt < new Date()) {
    // Delete the expired record
    await prisma.$executeRaw`DELETE FROM oauth_states WHERE id = ${record.id}`
    return { valid: false }
  }

  // Delete the used state (one-time use)
  await prisma.$executeRaw`DELETE FROM oauth_states WHERE id = ${record.id}`

  return {
    valid: true,
    redirectUri: record.redirect_uri || undefined
  }
}

/**
 * Clean up expired OAuth states from the database
 */
async function cleanupExpiredStates(): Promise<void> {
  await prisma.$executeRaw`DELETE FROM oauth_states WHERE expires_at < NOW()`
}

// Schedule periodic cleanup every 5 minutes
setInterval(() => {
  cleanupExpiredStates().catch(err => {
    console.error('[OAuth] Failed to cleanup expired states:', err)
  })
}, 5 * 60 * 1000)

// GET /api/auth/google - Initiate Google OAuth flow
oauthRouter.get('/google', async (_req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4007/api/auth/google/callback'

  try {
    if (!clientId || clientId === 'mock-google-client-id.apps.googleusercontent.com') {
      // Development mode: Redirect to a mock OAuth flow
      console.log('[OAuth] Google OAuth not configured, using development mock flow')

      // Generate a state token for security (using database storage)
      const state = await createOAuthState()

      // Redirect to our mock callback with a test user
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174'
      return res.redirect(`${frontendUrl}/auth/oauth-mock?provider=google&state=${state}`)
    }

    // Production mode: Redirect to actual Google OAuth
    const state = await createOAuthState()

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state: state,
      access_type: 'offline',
      prompt: 'consent'
    })

    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
  } catch (error) {
    console.error('[OAuth] Failed to initiate OAuth flow:', error)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174'
    res.redirect(`${frontendUrl}/login?error=oauth_init_failed`)
  }
})

// GET /api/auth/google/callback - Handle Google OAuth callback
oauthRouter.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174'

  // Handle OAuth errors
  if (error) {
    console.error('[OAuth] Google OAuth error:', error)
    return res.redirect(`${frontendUrl}/login?error=oauth_failed&message=${encodeURIComponent(String(error))}`)
  }

  // Verify state token using database storage
  if (!state) {
    console.error('[OAuth] No state token provided')
    return res.redirect(`${frontendUrl}/login?error=invalid_state`)
  }

  const stateVerification = await verifyOAuthState(String(state))
  if (!stateVerification.valid) {
    console.error('[OAuth] Invalid or expired state token')
    return res.redirect(`${frontendUrl}/login?error=invalid_state`)
  }

  if (!code) {
    console.error('[OAuth] No authorization code received')
    return res.redirect(`${frontendUrl}/login?error=no_code`)
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4007/api/auth/google/callback'

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code),
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('[OAuth] Token exchange failed:', errorData)
      return res.redirect(`${frontendUrl}/login?error=token_exchange_failed`)
    }

    const tokens = await tokenResponse.json() as { access_token: string; id_token?: string }

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    })

    if (!userInfoResponse.ok) {
      console.error('[OAuth] Failed to get user info')
      return res.redirect(`${frontendUrl}/login?error=user_info_failed`)
    }

    const googleUser = await userInfoResponse.json() as {
      id: string
      email: string
      name?: string
      picture?: string
      verified_email?: boolean
    }

    // Find or create user
    const { user, token } = await findOrCreateOAuthUser({
      provider: 'google',
      providerId: googleUser.id,
      email: googleUser.email,
      fullName: googleUser.name,
      avatarUrl: googleUser.picture,
      emailVerified: googleUser.verified_email ?? true
    })

    console.log(`[OAuth] User logged in via Google: ${user.email}`)

    // Redirect to frontend with token
    res.redirect(`${frontendUrl}/auth/oauth-callback?token=${token}&provider=google`)

  } catch (error) {
    console.error('[OAuth] Google OAuth callback error:', error)
    res.redirect(`${frontendUrl}/login?error=oauth_callback_failed`)
  }
})

// POST /api/auth/google/token - Exchange Google ID token for app token (for frontend SDK)
oauthRouter.post('/google/token', async (req, res) => {
  try {
    const { credential, clientId } = req.body

    if (!credential) {
      return res.status(400).json({ message: 'Google credential is required' })
    }

    // Decode the JWT (in production, verify with Google's public keys)
    const parts = credential.split('.')
    if (parts.length !== 3) {
      return res.status(400).json({ message: 'Invalid credential format' })
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())

    // Verify the audience matches our client ID
    const expectedClientId = process.env.GOOGLE_CLIENT_ID
    if (payload.aud !== expectedClientId && payload.aud !== clientId) {
      console.warn('[OAuth] Client ID mismatch:', payload.aud, 'vs', expectedClientId)
      // In development, allow mismatched client IDs
      if (process.env.NODE_ENV === 'production') {
        return res.status(400).json({ message: 'Invalid client ID' })
      }
    }

    // Extract user info from the token
    const googleUser = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      verified_email: payload.email_verified
    }

    // Find or create user
    const { user, token } = await findOrCreateOAuthUser({
      provider: 'google',
      providerId: googleUser.id,
      email: googleUser.email,
      fullName: googleUser.name,
      avatarUrl: googleUser.picture,
      emailVerified: googleUser.verified_email ?? true
    })

    console.log(`[OAuth] User logged in via Google token: ${user.email}`)

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        companyId: user.companyId,
        companyName: user.companyName,
        avatarUrl: user.avatarUrl
      },
      token
    })

  } catch (error) {
    console.error('[OAuth] Google token exchange error:', error)
    res.status(500).json({ message: 'Failed to authenticate with Google' })
  }
})

// POST /api/auth/oauth/mock - Development mock OAuth (simulates successful OAuth)
oauthRouter.post('/oauth/mock', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ message: 'Not found' })
  }

  try {
    const { provider, email, name } = req.body

    if (!email) {
      return res.status(400).json({ message: 'Email is required for mock OAuth' })
    }

    // Create a mock user
    const mockProviderId = `mock_${provider}_${Date.now()}`

    const { user, token } = await findOrCreateOAuthUser({
      provider: provider || 'google',
      providerId: mockProviderId,
      email,
      fullName: name || email.split('@')[0],
      emailVerified: true
    })

    console.log(`[OAuth Mock] User logged in: ${user.email}`)

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        companyId: user.companyId,
        companyName: user.companyName
      },
      token
    })

  } catch (error) {
    console.error('[OAuth Mock] Error:', error)
    res.status(500).json({ message: 'Mock OAuth failed' })
  }
})

// Helper function to find or create an OAuth user
async function findOrCreateOAuthUser(params: {
  provider: string
  providerId: string
  email: string
  fullName?: string
  avatarUrl?: string
  emailVerified?: boolean
}) {
  const { provider, providerId, email, fullName, avatarUrl, emailVerified = true } = params

  // First, try to find user by email
  let user = await prisma.user.findUnique({
    where: { email },
    include: {
      company: { select: { name: true } }
    }
  })

  if (user) {
    // Update OAuth provider info using parameterized query
    await prisma.$executeRaw`UPDATE users SET oauth_provider = ${provider}, oauth_provider_id = ${providerId}, avatar_url = COALESCE(${avatarUrl}, avatar_url) WHERE id = ${user.id}`

    // If user wasn't verified before, mark as verified now (OAuth verifies email)
    if (!user.emailVerified && emailVerified) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date()
        }
      })
    }
  } else {
    // Create new user
    user = await prisma.user.create({
      data: {
        email,
        fullName: fullName || email.split('@')[0],
        emailVerified,
        emailVerifiedAt: emailVerified ? new Date() : null,
        avatarUrl
      },
      include: {
        company: { select: { name: true } }
      }
    })

    // Update OAuth fields using parameterized query (to handle fields not in Prisma schema)
    await prisma.$executeRaw`UPDATE users SET oauth_provider = ${provider}, oauth_provider_id = ${providerId} WHERE id = ${user.id}`

    console.log(`[OAuth] Created new user: ${email}`)
  }

  // Generate JWT token
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.roleInCompany
  })

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.roleInCompany,
      companyId: user.companyId,
      companyName: user.company?.name || null,
      avatarUrl: user.avatarUrl
    },
    token
  }
}

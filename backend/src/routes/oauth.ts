import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { generateToken } from '../lib/auth.js'
import crypto from 'crypto'

export const oauthRouter = Router()

// Store OAuth state tokens temporarily (in production, use Redis or database)
const oauthStates = new Map<string, { createdAt: number; redirectUri?: string }>()

// Clean up expired states every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [state, data] of oauthStates.entries()) {
    if (now - data.createdAt > 10 * 60 * 1000) { // 10 minutes expiry
      oauthStates.delete(state)
    }
  }
}, 5 * 60 * 1000)

// GET /api/auth/google - Initiate Google OAuth flow
oauthRouter.get('/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4007/api/auth/google/callback'

  if (!clientId || clientId === 'mock-google-client-id.apps.googleusercontent.com') {
    // Development mode: Redirect to a mock OAuth flow
    console.log('[OAuth] Google OAuth not configured, using development mock flow')

    // Generate a state token for security
    const state = crypto.randomBytes(16).toString('hex')
    oauthStates.set(state, { createdAt: Date.now() })

    // Redirect to our mock callback with a test user
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174'
    return res.redirect(`${frontendUrl}/auth/oauth-mock?provider=google&state=${state}`)
  }

  // Production mode: Redirect to actual Google OAuth
  const state = crypto.randomBytes(16).toString('hex')
  oauthStates.set(state, { createdAt: Date.now() })

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

  // Verify state token
  if (!state || !oauthStates.has(String(state))) {
    console.error('[OAuth] Invalid state token')
    return res.redirect(`${frontendUrl}/login?error=invalid_state`)
  }
  oauthStates.delete(String(state))

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
    // Update OAuth provider info using raw SQL
    await prisma.$executeRawUnsafe(
      `UPDATE users SET oauth_provider = ?, oauth_provider_id = ?, avatar_url = COALESCE(?, avatar_url) WHERE id = ?`,
      provider,
      providerId,
      avatarUrl,
      user.id
    )

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

    // Update OAuth fields using raw SQL (to handle fields not in Prisma schema)
    await prisma.$executeRawUnsafe(
      `UPDATE users SET oauth_provider = ?, oauth_provider_id = ? WHERE id = ?`,
      provider,
      providerId,
      user.id
    )

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

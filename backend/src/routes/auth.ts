import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { generateToken, generateExpiredToken, hashPassword, verifyPassword } from '../lib/auth.js'

export const authRouter = Router()

// POST /api/auth/register
authRouter.post('/register', async (req, res) => {
  try {
    const { email, password, fullName, firstName, lastName } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' })
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return res.status(400).json({ message: 'Email already in use' })
    }

    // Build full name from parts if not provided directly
    const name = fullName || (firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || null)

    // Create user
    const passwordHash = hashPassword(password)
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: name,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        roleInCompany: true,
      },
    })

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.roleInCompany,
    })

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.roleInCompany,
      },
      token,
    })
  } catch (error) {
    console.error('Registration error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// POST /api/auth/login
authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' })
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        fullName: true,
        roleInCompany: true,
        companyId: true,
        company: {
          select: {
            name: true,
          },
        },
      },
    })

    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    // Verify password
    if (!verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.roleInCompany,
    })

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.roleInCompany,
        companyId: user.companyId,
        companyName: user.company?.name || null,
      },
      token,
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// GET /api/auth/me
authRouter.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const token = authHeader.substring(7)

    // Import verifyToken dynamically to avoid circular import
    const { verifyToken } = await import('../lib/auth.js')
    const user = await verifyToken(token)

    if (!user) {
      return res.status(401).json({ message: 'Invalid token' })
    }

    res.json({ user })
  } catch (error) {
    console.error('Get me error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// POST /api/auth/logout
authRouter.post('/logout', (_req, res) => {
  // For JWT-based auth, client simply clears the token
  res.json({ message: 'Logged out successfully' })
})

// POST /api/auth/forgot-password - Request a password reset
authRouter.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ message: 'Email is required' })
    }

    // Find user - but don't reveal if email exists (security best practice)
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    })

    // Always respond with success message (don't reveal if email exists)
    // But only send email if user exists
    if (user) {
      // Generate a secure random token
      const crypto = await import('crypto')
      const token = crypto.randomBytes(32).toString('hex')

      // Token expires in 1 hour
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

      // Invalidate any existing tokens for this user
      await prisma.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
          expiresAt: { gt: new Date() }
        },
        data: { usedAt: new Date() } // Mark as used to invalidate
      })

      // Create new token
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        },
      })

      // In development, log the reset link to console
      const resetUrl = `http://localhost:5173/reset-password?token=${token}`
      console.log('')
      console.log('========================================')
      console.log('🔑 PASSWORD RESET LINK (Development Mode)')
      console.log('========================================')
      console.log(`Email: ${email}`)
      console.log(`Token: ${token}`)
      console.log(`Reset URL: ${resetUrl}`)
      console.log(`Expires: ${expiresAt.toISOString()}`)
      console.log('========================================')
      console.log('')
    }

    // Always return success (security: don't reveal if email exists)
    res.json({
      message: 'If an account exists with this email, a password reset link has been sent.'
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// POST /api/auth/reset-password - Reset password with token
authRouter.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body

    if (!token || !password) {
      return res.status(400).json({ message: 'Token and new password are required' })
    }

    // Validate password requirements
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' })
    }

    // Find the token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!resetToken) {
      return res.status(400).json({ message: 'Invalid or expired reset token' })
    }

    // Check if token has been used
    if (resetToken.usedAt) {
      return res.status(400).json({ message: 'This reset token has already been used' })
    }

    // Check if token has expired
    if (resetToken.expiresAt < new Date()) {
      return res.status(400).json({ message: 'This reset token has expired' })
    }

    // Hash the new password
    const newPasswordHash = hashPassword(password)

    // Update user password and mark token as used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash: newPasswordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ])

    console.log(`✅ Password reset successful for: ${resetToken.user.email}`)

    res.json({ message: 'Password has been reset successfully. You can now log in with your new password.' })
  } catch (error) {
    console.error('Reset password error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// GET /api/auth/validate-reset-token - Check if a reset token is valid
authRouter.get('/validate-reset-token', async (req, res) => {
  try {
    const { token } = req.query

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ valid: false, message: 'Token is required' })
    }

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    })

    if (!resetToken) {
      return res.json({ valid: false, message: 'Invalid reset token' })
    }

    if (resetToken.usedAt) {
      return res.json({ valid: false, message: 'This reset token has already been used' })
    }

    if (resetToken.expiresAt < new Date()) {
      return res.json({ valid: false, message: 'This reset token has expired' })
    }

    res.json({ valid: true })
  } catch (error) {
    console.error('Validate reset token error:', error)
    res.status(500).json({ valid: false, message: 'Internal server error' })
  }
})

// POST /api/auth/test-expired-token - Generate an expired token for testing
// Only available in development
authRouter.post('/test-expired-token', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ message: 'Not found' })
  }

  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        roleInCompany: true,
      },
    })

    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    if (!verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    // Generate an expired token for testing
    const expiredToken = generateExpiredToken({
      userId: user.id,
      email: user.email,
      role: user.roleInCompany,
    })

    res.json({ expiredToken })
  } catch (error) {
    console.error('Test expired token error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { generateToken, generateExpiredToken, hashPassword, verifyPassword, verifyToken } from '../lib/auth.js'
import { sendMagicLinkEmail } from '../lib/email.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

export const authRouter = Router()

// Configure multer for avatar uploads
const avatarUploadDir = path.join(process.cwd(), 'uploads', 'avatars')
if (!fs.existsSync(avatarUploadDir)) {
  fs.mkdirSync(avatarUploadDir, { recursive: true })
}

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, avatarUploadDir)
  },
  filename: (req, file, cb) => {
    const userId = (req as any).userId || 'unknown'
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `avatar-${userId}-${Date.now()}${ext}`)
  }
})

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF and WebP are allowed.'))
    }
  }
})

// Current ToS version - update when ToS changes
const CURRENT_TOS_VERSION = '1.0'

// Password validation schema
const PASSWORD_MIN_LENGTH = 12
const PASSWORD_REQUIREMENTS = {
  minLength: PASSWORD_MIN_LENGTH,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
}

function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  }
  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }
  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }
  if (PASSWORD_REQUIREMENTS.requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  }
  if (PASSWORD_REQUIREMENTS.requireSpecial && !/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }

  return { valid: errors.length === 0, errors }
}

// POST /api/auth/register
authRouter.post('/register', async (req, res) => {
  try {
    const { email, password, fullName, firstName, lastName, tosAccepted } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' })
    }

    // Validate password strength
    const passwordValidation = validatePassword(password)
    if (!passwordValidation.valid) {
      return res.status(400).json({
        message: 'Password does not meet security requirements',
        errors: passwordValidation.errors
      })
    }

    // Require ToS acceptance
    if (!tosAccepted) {
      return res.status(400).json({ message: 'You must accept the Terms of Service to create an account' })
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

    // Create user with emailVerified set to false and ToS acceptance recorded
    const passwordHash = hashPassword(password)
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: name,
        emailVerified: false,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        roleInCompany: true,
        emailVerified: true,
      },
    })

    // Record ToS acceptance using parameterized query
    const tosAcceptedAt = new Date().toISOString()
    await prisma.$executeRaw`UPDATE users SET tos_accepted_at = ${tosAcceptedAt}, tos_version = ${CURRENT_TOS_VERSION} WHERE id = ${user.id}`

    // Generate email verification token
    const crypto = await import('crypto')
    const verificationToken = crypto.randomBytes(32).toString('hex')

    // Token expires in 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token: verificationToken,
        expiresAt,
      },
    })

    // In development, log the verification link to console
    const verifyUrl = `http://localhost:5173/verify-email?token=${verificationToken}`
    console.log('')
    console.log('========================================')
    console.log('📧 EMAIL VERIFICATION LINK (Development Mode)')
    console.log('========================================')
    console.log(`Email: ${email}`)
    console.log(`Token: ${verificationToken}`)
    console.log(`Verify URL: ${verifyUrl}`)
    console.log(`Expires: ${expiresAt.toISOString()}`)
    console.log('========================================')
    console.log('')

    // Generate auth token
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
        emailVerified: user.emailVerified,
      },
      token,
      message: 'Account created. Please check your email to verify your account.',
      verificationRequired: true,
    })
  } catch (error) {
    console.error('Registration error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// POST /api/auth/login
authRouter.post('/login', async (req, res) => {
  try {
    const { email, password, mfaCode } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' })
    }

    // Find user with MFA fields using raw SQL
    const userResult = await prisma.$queryRaw<Array<{
      id: string
      email: string
      password_hash: string | null
      full_name: string | null
      role_in_company: string
      company_id: string | null
      two_factor_enabled: number
      two_factor_secret: string | null
    }>>`SELECT id, email, password_hash, full_name, role_in_company, company_id, two_factor_enabled, two_factor_secret FROM users WHERE email = ${email}`

    const user = userResult[0]

    if (!user || !user.password_hash) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    // Verify password
    if (!verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    // Check if MFA is enabled
    if (user.two_factor_enabled && user.two_factor_secret) {
      // If MFA code provided, verify it
      if (mfaCode) {
        const { verify: verifyOtp } = await import('otplib')
        const isValid = await verifyOtp({
          token: mfaCode,
          secret: user.two_factor_secret,
        })

        if (!isValid) {
          return res.status(401).json({ message: 'Invalid MFA code' })
        }
        // MFA verified, continue to generate token
      } else {
        // MFA required but no code provided
        return res.status(200).json({
          mfaRequired: true,
          userId: user.id,
          message: 'MFA verification required',
        })
      }
    }

    // Get company name
    let companyName: string | null = null
    if (user.company_id) {
      const companyResult = await prisma.$queryRaw<Array<{ name: string }>>`SELECT name FROM companies WHERE id = ${user.company_id}`
      companyName = companyResult[0]?.name || null
    }

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role_in_company,
    })

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role_in_company,
        companyId: user.company_id,
        companyName,
      },
      token,
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Magic link expiry time in minutes
const MAGIC_LINK_EXPIRY_MINUTES = 15

// POST /api/auth/magic-link/request - Request a magic link login email (Feature #1005)
authRouter.post('/magic-link/request', async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ message: 'Email is required' })
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        fullName: true,
      },
    })

    // Always return success to prevent email enumeration
    if (!user) {
      console.log(`[Magic Link] Request for non-existent email: ${email}`)
      return res.json({
        message: 'If an account exists with this email, a login link has been sent.',
      })
    }

    // Generate magic link token
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MINUTES * 60 * 1000)

    // Store token using password reset token table (reusing existing infrastructure)
    // Delete any existing tokens for this user first
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id }
    })

    // Create new magic link token
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: `magic_${token}`, // Prefix to distinguish from password reset tokens
        expiresAt,
      },
    })

    // Generate magic link URL
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5174'
    const magicLinkUrl = `${baseUrl}/auth/magic-link?token=magic_${token}`

    // Send magic link email
    await sendMagicLinkEmail({
      to: user.email,
      userName: user.fullName || undefined,
      magicLinkUrl,
      expiresInMinutes: MAGIC_LINK_EXPIRY_MINUTES,
    })

    console.log(`[Magic Link] Sent login link to ${user.email}`)

    res.json({
      message: 'If an account exists with this email, a login link has been sent.',
    })
  } catch (error) {
    console.error('Magic link request error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// POST /api/auth/magic-link/verify - Verify magic link and login (Feature #1005)
authRouter.post('/magic-link/verify', async (req, res) => {
  try {
    const { token } = req.body

    if (!token) {
      return res.status(400).json({ message: 'Token is required' })
    }

    // Only accept magic_ prefixed tokens
    if (!token.startsWith('magic_')) {
      return res.status(400).json({ message: 'Invalid token format' })
    }

    // Find the token
    const tokenRecord = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            roleInCompany: true,
            companyId: true,
            company: {
              select: { name: true },
            },
          },
        },
      },
    })

    if (!tokenRecord) {
      return res.status(400).json({ message: 'Invalid or expired link' })
    }

    // Check if token has expired
    if (tokenRecord.expiresAt < new Date()) {
      // Delete expired token
      await prisma.passwordResetToken.delete({
        where: { token },
      })
      return res.status(400).json({ message: 'This link has expired. Please request a new one.' })
    }

    // Check if token has already been used
    if (tokenRecord.usedAt) {
      return res.status(400).json({ message: 'This link has already been used. Please request a new one.' })
    }

    // Mark token as used
    await prisma.passwordResetToken.update({
      where: { token },
      data: { usedAt: new Date() },
    })

    // Generate JWT token for the user
    const authToken = generateToken({
      userId: tokenRecord.user.id,
      email: tokenRecord.user.email,
      role: tokenRecord.user.roleInCompany,
    })

    console.log(`[Magic Link] User ${tokenRecord.user.email} logged in via magic link`)

    res.json({
      user: {
        id: tokenRecord.user.id,
        email: tokenRecord.user.email,
        fullName: tokenRecord.user.fullName,
        role: tokenRecord.user.roleInCompany,
        companyId: tokenRecord.user.companyId,
        companyName: tokenRecord.user.company?.name || null,
      },
      token: authToken,
    })
  } catch (error) {
    console.error('Magic link verify error:', error)
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

// POST /api/auth/logout-all-devices - Invalidate all existing sessions
authRouter.post('/logout-all-devices', async (req, res) => {
  try {
    // Get the authorization header
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' })
    }

    const token = authHeader.substring(7)
    const user = await verifyToken(token)

    if (!user) {
      return res.status(401).json({ message: 'Invalid or expired token' })
    }

    // Update the token_invalidated_at timestamp to invalidate all existing tokens
    const now = new Date().toISOString()
    await prisma.$executeRaw`UPDATE users SET token_invalidated_at = ${now} WHERE id = ${user.userId}`

    console.log(`User ${user.email} logged out from all devices at ${now}`)

    res.json({
      message: 'Successfully logged out from all devices',
      loggedOutAt: now
    })
  } catch (error) {
    console.error('Logout all devices error:', error)
    res.status(500).json({ message: 'Failed to logout from all devices' })
  }
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

// PATCH /api/auth/profile - Update user profile
authRouter.patch('/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const token = authHeader.substring(7)

    // Import verifyToken dynamically to avoid circular import
    const { verifyToken } = await import('../lib/auth.js')
    const userData = await verifyToken(token)

    if (!userData) {
      return res.status(401).json({ message: 'Invalid token' })
    }

    const { fullName, phone } = req.body

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: userData.id },
      data: {
        fullName: fullName !== undefined ? fullName : undefined,
        phone: phone !== undefined ? phone : undefined,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        roleInCompany: true,
        companyId: true,
        company: {
          select: {
            name: true,
          },
        },
      },
    })

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        name: updatedUser.fullName,
        phone: updatedUser.phone,
        role: updatedUser.roleInCompany,
        companyId: updatedUser.companyId,
        companyName: updatedUser.company?.name || null,
      },
    })
  } catch (error) {
    console.error('Update profile error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// POST /api/auth/avatar - Upload user avatar (Feature #690)
authRouter.post('/avatar', avatarUpload.single('avatar'), async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const token = authHeader.substring(7)
    const { verifyToken } = await import('../lib/auth.js')
    const userData = await verifyToken(token)

    if (!userData) {
      return res.status(401).json({ message: 'Invalid token' })
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' })
    }

    // Get the old avatar to delete it later
    const oldUser = await prisma.user.findUnique({
      where: { id: userData.id },
      select: { avatarUrl: true }
    })

    // Build the avatar URL
    const apiUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 4003}`
    const avatarUrl = `${apiUrl}/uploads/avatars/${req.file.filename}`

    // Update user with new avatar URL
    const updatedUser = await prisma.user.update({
      where: { id: userData.id },
      data: { avatarUrl },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        phone: true,
        roleInCompany: true,
        companyId: true,
      },
    })

    // Delete old avatar file if it exists
    if (oldUser?.avatarUrl) {
      try {
        const oldFilename = oldUser.avatarUrl.split('/').pop()
        if (oldFilename) {
          const oldFilePath = path.join(avatarUploadDir, oldFilename)
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath)
          }
        }
      } catch (err) {
        console.error('Failed to delete old avatar:', err)
      }
    }

    res.json({
      message: 'Avatar uploaded successfully',
      avatarUrl: updatedUser.avatarUrl,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        name: updatedUser.fullName,
        avatarUrl: updatedUser.avatarUrl,
        phone: updatedUser.phone,
        role: updatedUser.roleInCompany,
        companyId: updatedUser.companyId,
      },
    })
  } catch (error) {
    console.error('Avatar upload error:', error)
    res.status(500).json({ message: 'Failed to upload avatar' })
  }
})

// DELETE /api/auth/avatar - Remove user avatar
authRouter.delete('/avatar', async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const token = authHeader.substring(7)
    const { verifyToken } = await import('../lib/auth.js')
    const userData = await verifyToken(token)

    if (!userData) {
      return res.status(401).json({ message: 'Invalid token' })
    }

    // Get the current avatar URL to delete the file
    const user = await prisma.user.findUnique({
      where: { id: userData.id },
      select: { avatarUrl: true }
    })

    if (user?.avatarUrl) {
      try {
        const filename = user.avatarUrl.split('/').pop()
        if (filename) {
          const filePath = path.join(avatarUploadDir, filename)
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
          }
        }
      } catch (err) {
        console.error('Failed to delete avatar file:', err)
      }
    }

    // Update user to remove avatar URL
    await prisma.user.update({
      where: { id: userData.id },
      data: { avatarUrl: null },
    })

    res.json({ message: 'Avatar removed successfully' })
  } catch (error) {
    console.error('Avatar delete error:', error)
    res.status(500).json({ message: 'Failed to remove avatar' })
  }
})

// POST /api/auth/change-password - Change user password (requires current password)
authRouter.post('/change-password', async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const token = authHeader.substring(7)

    // Import verifyToken dynamically to avoid circular import
    const { verifyToken } = await import('../lib/auth.js')
    const userData = await verifyToken(token)

    if (!userData) {
      return res.status(401).json({ message: 'Invalid token' })
    }

    const { currentPassword, newPassword, confirmPassword } = req.body

    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'Current password, new password, and confirm password are required' })
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'New password and confirm password do not match' })
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters long' })
    }

    // Get user with password hash
    const user = await prisma.user.findUnique({
      where: { id: userData.userId || userData.id },
      select: { id: true, passwordHash: true },
    })

    if (!user || !user.passwordHash) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Verify current password
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return res.status(401).json({ message: 'Current password is incorrect' })
    }

    // Hash and update password
    const newPasswordHash = hashPassword(newPassword)
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    })

    console.log(`✅ Password changed for user: ${userData.email}`)

    res.json({ message: 'Password changed successfully' })
  } catch (error) {
    console.error('Change password error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// POST /api/auth/verify-email - Verify email with token
authRouter.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body

    if (!token) {
      return res.status(400).json({ message: 'Verification token is required' })
    }

    // Find the token
    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!verificationToken) {
      return res.status(400).json({ message: 'Invalid verification token' })
    }

    // Check if token has been used
    if (verificationToken.usedAt) {
      return res.status(400).json({ message: 'This verification token has already been used' })
    }

    // Check if token has expired
    if (verificationToken.expiresAt < new Date()) {
      return res.status(400).json({ message: 'This verification token has expired' })
    }

    // Check if user is already verified
    if (verificationToken.user.emailVerified) {
      return res.status(400).json({ message: 'Email is already verified' })
    }

    // Update user and mark token as used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: verificationToken.userId },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      }),
      prisma.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: { usedAt: new Date() },
      }),
    ])

    console.log(`✅ Email verified for: ${verificationToken.user.email}`)

    res.json({
      message: 'Email verified successfully. You can now log in.',
      verified: true,
    })
  } catch (error) {
    console.error('Verify email error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// GET /api/auth/verify-email-status - Check verification status
authRouter.get('/verify-email-status', async (req, res) => {
  try {
    const { token } = req.query

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ valid: false, message: 'Token is required' })
    }

    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: { select: { email: true, emailVerified: true } } },
    })

    if (!verificationToken) {
      return res.json({ valid: false, message: 'Invalid verification token' })
    }

    if (verificationToken.usedAt) {
      return res.json({ valid: false, message: 'This verification token has already been used', alreadyVerified: true })
    }

    if (verificationToken.expiresAt < new Date()) {
      return res.json({ valid: false, message: 'This verification token has expired', expired: true })
    }

    if (verificationToken.user.emailVerified) {
      return res.json({ valid: false, message: 'Email is already verified', alreadyVerified: true })
    }

    res.json({ valid: true, email: verificationToken.user.email })
  } catch (error) {
    console.error('Verify email status error:', error)
    res.status(500).json({ valid: false, message: 'Internal server error' })
  }
})

// POST /api/auth/resend-verification - Resend verification email
authRouter.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ message: 'Email is required' })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, emailVerified: true },
    })

    // Always return success (don't reveal if email exists)
    if (!user) {
      return res.json({
        message: 'If an account exists with this email, a new verification link has been sent.'
      })
    }

    if (user.emailVerified) {
      return res.json({
        message: 'Email is already verified. You can log in.',
        alreadyVerified: true,
      })
    }

    // Invalidate any existing tokens for this user
    await prisma.emailVerificationToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() }
      },
      data: { usedAt: new Date() } // Mark as used to invalidate
    })

    // Generate new verification token
    const crypto = await import('crypto')
    const verificationToken = crypto.randomBytes(32).toString('hex')

    // Token expires in 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token: verificationToken,
        expiresAt,
      },
    })

    // In development, log the verification link to console
    const verifyUrl = `http://localhost:5173/verify-email?token=${verificationToken}`
    console.log('')
    console.log('========================================')
    console.log('📧 EMAIL VERIFICATION LINK (Resent - Development Mode)')
    console.log('========================================')
    console.log(`Email: ${email}`)
    console.log(`Token: ${verificationToken}`)
    console.log(`Verify URL: ${verifyUrl}`)
    console.log(`Expires: ${expiresAt.toISOString()}`)
    console.log('========================================')
    console.log('')

    res.json({
      message: 'If an account exists with this email, a new verification link has been sent.'
    })
  } catch (error) {
    console.error('Resend verification error:', error)
    res.status(500).json({ message: 'Internal server error' })
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

// GET /api/auth/export-data - GDPR compliant data export
// Returns all user data in a portable JSON format
authRouter.get('/export-data', async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const token = authHeader.substring(7)
    // Import verifyToken dynamically to avoid circular import
    const { verifyToken } = await import('../lib/auth.js')
    const userData = await verifyToken(token)

    if (!userData) {
      return res.status(401).json({ message: 'Invalid token' })
    }

    const userId = userData.userId || userData.id

    // Fetch all user-related data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            abn: true,
            address: true,
          },
        },
        projectUsers: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                projectNumber: true,
                status: true,
                createdAt: true,
              },
            },
          },
        },
      },
    })

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Get NCRs raised by or assigned to the user
    const ncrs = await prisma.nCR.findMany({
      where: {
        OR: [
          { raisedById: userId },
          { responsibleUserId: userId },
        ],
      },
      select: {
        id: true,
        ncrNumber: true,
        description: true,
        status: true,
        severity: true,
        category: true,
        raisedAt: true,
        closedAt: true,
      },
    })

    // Get daily diaries submitted by user
    const diaries = await prisma.dailyDiary.findMany({
      where: { submittedById: userId },
      select: {
        id: true,
        date: true,
        weatherConditions: true,
        temperatureMin: true,
        temperatureMax: true,
        rainfallMm: true,
        generalNotes: true,
        status: true,
        submittedAt: true,
        createdAt: true,
      },
    })

    // Get ITP completions by user
    const itpCompletions = await prisma.iTPCompletion.findMany({
      where: { completedById: userId },
      select: {
        id: true,
        completedAt: true,
        notes: true,
        checklistItem: {
          select: {
            description: true,
            sequenceNumber: true,
          },
        },
      },
    })

    // Get test results entered by user
    const testResults = await prisma.testResult.findMany({
      where: { enteredById: userId },
      select: {
        id: true,
        testType: true,
        testDate: true,
        resultValue: true,
        resultUnit: true,
        passFail: true,
        laboratoryName: true,
        laboratoryReportNumber: true,
        createdAt: true,
      },
    })

    // Get lots created by user
    const lotsCreated = await prisma.lot.findMany({
      where: { createdById: userId },
      select: {
        id: true,
        lotNumber: true,
        description: true,
        activityType: true,
        status: true,
        createdAt: true,
      },
    })

    // Get audit log entries for this user
    const auditLogs = await prisma.auditLog.findMany({
      where: { userId },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        changes: true,
        ipAddress: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 1000, // Limit to last 1000 entries
    })

    // Build the export data structure
    const exportData = {
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.roleInCompany,
        emailVerified: user.emailVerified,
        emailVerifiedAt: user.emailVerifiedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      company: user.company ? {
        id: user.company.id,
        name: user.company.name,
        abn: user.company.abn,
        address: user.company.address,
      } : null,
      projectMemberships: user.projectUsers.map(pu => ({
        role: pu.role,
        invitedAt: pu.invitedAt,
        acceptedAt: pu.acceptedAt,
        status: pu.status,
        project: pu.project,
      })),
      ncrs: ncrs,
      dailyDiaries: diaries.map(d => ({
        id: d.id,
        date: d.date,
        weatherConditions: d.weatherConditions,
        temperatureMin: d.temperatureMin,
        temperatureMax: d.temperatureMax,
        rainfallMm: d.rainfallMm,
        notes: d.generalNotes,
        status: d.status,
        submittedAt: d.submittedAt,
        createdAt: d.createdAt,
      })),
      itpCompletions: itpCompletions.map(c => ({
        id: c.id,
        completedAt: c.completedAt,
        notes: c.notes,
        checklistItemDescription: c.checklistItem?.description,
        checklistItemSequence: c.checklistItem?.sequenceNumber,
      })),
      testResults: testResults,
      lotsCreated: lotsCreated,
      activityLog: auditLogs,
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="siteproof-data-export-${user.email}-${new Date().toISOString().split('T')[0]}.json"`)

    res.json(exportData)
  } catch (error) {
    console.error('Data export error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// GDPR Data Deletion endpoint
authRouter.delete('/delete-account', async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const token = authHeader.substring(7)
    const { verifyToken } = await import('../lib/auth.js')
    const userData = await verifyToken(token)

    if (!userData) {
      return res.status(401).json({ message: 'Invalid token' })
    }

    const userId = userData.userId || userData.id

    // Get the confirmation password from request body
    const { password, confirmEmail } = req.body

    if (!confirmEmail) {
      return res.status(400).json({ message: 'Email confirmation required' })
    }

    // Verify the user exists and get their data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        fullName: true,
        companyId: true,
        roleInCompany: true,
      },
    })

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Verify email matches
    if (confirmEmail.toLowerCase() !== user.email.toLowerCase()) {
      return res.status(400).json({ message: 'Email confirmation does not match' })
    }

    // Verify password if the user has one set
    if (user.passwordHash && password) {
      const bcrypt = await import('bcryptjs')
      const isValidPassword = await bcrypt.compare(password, user.passwordHash)
      if (!isValidPassword) {
        return res.status(400).json({ message: 'Invalid password' })
      }
    }

    // Create an audit log entry before deletion (for compliance)
    await prisma.auditLog.create({
      data: {
        entityType: 'user',
        entityId: user.id,
        action: 'account_deletion_requested',
        changes: JSON.stringify({
          email: user.email,
          fullName: user.fullName,
          deletedAt: new Date().toISOString(),
          reason: 'GDPR deletion request',
        }),
        userId: userId,
        ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      },
    })

    // Delete all user-related data in order (respecting foreign key constraints)
    // The order matters due to foreign key relationships

    // 1. Delete ITP completions by user
    await prisma.iTPCompletion.deleteMany({
      where: { completedById: userId },
    })

    // 2. Delete email verification tokens
    await prisma.emailVerificationToken.deleteMany({
      where: { userId },
    })

    // 3. Delete password reset tokens
    await prisma.passwordResetToken.deleteMany({
      where: { userId },
    })

    // 4. Delete project user memberships (this removes the user from all projects)
    await prisma.projectUser.deleteMany({
      where: { userId },
    })

    // 5. Delete the audit log for this user (anonymize - the account_deletion audit remains)
    await prisma.auditLog.updateMany({
      where: { userId },
      data: { userId: null },
    })

    // 6. Finally, delete the user record
    await prisma.user.delete({
      where: { id: userId },
    })

    console.log(`Account deleted for user: ${user.email} (ID: ${userId})`)

    res.json({
      success: true,
      message: 'Your account and associated data have been permanently deleted.',
    })
  } catch (error) {
    console.error('Account deletion error:', error)
    res.status(500).json({ message: 'Failed to delete account. Please contact support.' })
  }
})

import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { generateToken, generateExpiredToken, hashPassword, verifyPassword, verifyToken } from '../lib/auth.js'
import { sendMagicLinkEmail, sendVerificationEmail, sendPasswordResetEmail } from '../lib/email.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { AppError } from '../lib/AppError.js'
import { asyncHandler } from '../lib/asyncHandler.js'

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
    const userId = req.user?.userId || 'unknown'
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
authRouter.post('/register', asyncHandler(async (req, res) => {
    const { email, password, fullName, firstName, lastName, tosAccepted } = req.body

    if (!email || !password) {
      throw AppError.badRequest('Email and password are required')
    }

    // Validate password strength
    const passwordValidation = validatePassword(password)
    if (!passwordValidation.valid) {
      throw AppError.badRequest('Password does not meet security requirements', {
        errors: passwordValidation.errors as unknown as Record<string, unknown>,
      })
    }

    // Require ToS acceptance
    if (!tosAccepted) {
      throw AppError.badRequest('You must accept the Terms of Service to create an account')
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      throw AppError.badRequest('Email already in use')
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
    // Use PostgreSQL NOW() function for timestamp compatibility
    await prisma.$executeRaw`UPDATE users SET tos_accepted_at = NOW(), tos_version = ${CURRENT_TOS_VERSION} WHERE id = ${user.id}`

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

    // Build verification URL using FRONTEND_URL
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5174'
    const verifyUrl = `${baseUrl}/verify-email?token=${verificationToken}`

    // Send verification email
    await sendVerificationEmail({
      to: email,
      userName: name || undefined,
      verificationUrl: verifyUrl,
      expiresInHours: 24,
    })

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
}))

// POST /api/auth/login
authRouter.post('/login', asyncHandler(async (req, res) => {
    const { email, password, mfaCode } = req.body

    if (!email || !password) {
      throw AppError.badRequest('Email and password are required')
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
      throw AppError.unauthorized('Invalid email or password')
    }

    // Verify password
    if (!verifyPassword(password, user.password_hash)) {
      throw AppError.unauthorized('Invalid email or password')
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
          throw AppError.unauthorized('Invalid MFA code')
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
}))

// Magic link expiry time in minutes
const MAGIC_LINK_EXPIRY_MINUTES = 15

// POST /api/auth/magic-link/request - Request a magic link login email (Feature #1005)
authRouter.post('/magic-link/request', asyncHandler(async (req, res) => {
    const { email } = req.body

    if (!email) {
      throw AppError.badRequest('Email is required')
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

    res.json({
      message: 'If an account exists with this email, a login link has been sent.',
    })
}))

// POST /api/auth/magic-link/verify - Verify magic link and login (Feature #1005)
authRouter.post('/magic-link/verify', asyncHandler(async (req, res) => {
    const { token } = req.body

    if (!token) {
      throw AppError.badRequest('Token is required')
    }

    // Only accept magic_ prefixed tokens
    if (!token.startsWith('magic_')) {
      throw AppError.badRequest('Invalid token format')
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
      throw AppError.badRequest('Invalid or expired link')
    }

    // Check if token has expired
    if (tokenRecord.expiresAt < new Date()) {
      // Delete expired token
      await prisma.passwordResetToken.delete({
        where: { token },
      })
      throw AppError.badRequest('This link has expired. Please request a new one.')
    }

    // Check if token has already been used
    if (tokenRecord.usedAt) {
      throw AppError.badRequest('This link has already been used. Please request a new one.')
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
}))

// GET /api/auth/me
authRouter.get('/me', asyncHandler(async (req, res) => {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized()
    }

    const token = authHeader.substring(7)

    // Import verifyToken dynamically to avoid circular import
    const { verifyToken } = await import('../lib/auth.js')
    const user = await verifyToken(token)

    if (!user) {
      throw AppError.unauthorized('Invalid token')
    }

    res.json({ user })
}))

// POST /api/auth/logout
authRouter.post('/logout', (_req, res) => {
  // For JWT-based auth, client simply clears the token
  res.json({ message: 'Logged out successfully' })
})

// POST /api/auth/logout-all-devices - Invalidate all existing sessions
authRouter.post('/logout-all-devices', asyncHandler(async (req, res) => {
    // Get the authorization header
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized('Authentication required')
    }

    const token = authHeader.substring(7)
    const user = await verifyToken(token)

    if (!user) {
      throw AppError.unauthorized('Invalid or expired token')
    }

    // Update the token_invalidated_at timestamp to invalidate all existing tokens
    // Use PostgreSQL NOW() function for timestamp compatibility
    await prisma.$executeRaw`UPDATE users SET token_invalidated_at = NOW() WHERE id = ${user.userId}`

    const now = new Date().toISOString()

    res.json({
      message: 'Successfully logged out from all devices',
      loggedOutAt: now
    })
}))

// POST /api/auth/forgot-password - Request a password reset
authRouter.post('/forgot-password', asyncHandler(async (req, res) => {
    const { email } = req.body

    if (!email) {
      throw AppError.badRequest('Email is required')
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

      // Build reset URL using FRONTEND_URL
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5174'
      const resetUrl = `${baseUrl}/reset-password?token=${token}`

      // Send password reset email
      await sendPasswordResetEmail({
        to: user.email,
        resetUrl,
        expiresInMinutes: 60,
      })
    }

    // Always return success (security: don't reveal if email exists)
    res.json({
      message: 'If an account exists with this email, a password reset link has been sent.'
    })
}))

// POST /api/auth/reset-password - Reset password with token
authRouter.post('/reset-password', asyncHandler(async (req, res) => {
    const { token, password } = req.body

    if (!token || !password) {
      throw AppError.badRequest('Token and new password are required')
    }

    // Validate password requirements
    if (password.length < 8) {
      throw AppError.badRequest('Password must be at least 8 characters long')
    }

    // Find the token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!resetToken) {
      throw AppError.badRequest('Invalid or expired reset token')
    }

    // Check if token has been used
    if (resetToken.usedAt) {
      throw AppError.badRequest('This reset token has already been used')
    }

    // Check if token has expired
    if (resetToken.expiresAt < new Date()) {
      throw AppError.badRequest('This reset token has expired')
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

    res.json({ message: 'Password has been reset successfully. You can now log in with your new password.' })
}))

// GET /api/auth/validate-reset-token - Check if a reset token is valid
authRouter.get('/validate-reset-token', asyncHandler(async (req, res) => {
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
}))

// PATCH /api/auth/profile - Update user profile
authRouter.patch('/profile', asyncHandler(async (req, res) => {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized()
    }

    const token = authHeader.substring(7)

    // Import verifyToken dynamically to avoid circular import
    const { verifyToken } = await import('../lib/auth.js')
    const userData = await verifyToken(token)

    if (!userData) {
      throw AppError.unauthorized('Invalid token')
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
}))

// POST /api/auth/avatar - Upload user avatar (Feature #690)
authRouter.post('/avatar', avatarUpload.single('avatar'), asyncHandler(async (req, res) => {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized()
    }

    const token = authHeader.substring(7)
    const { verifyToken } = await import('../lib/auth.js')
    const userData = await verifyToken(token)

    if (!userData) {
      throw AppError.unauthorized('Invalid token')
    }

    if (!req.file) {
      throw AppError.badRequest('No file uploaded')
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
}))

// DELETE /api/auth/avatar - Remove user avatar
authRouter.delete('/avatar', asyncHandler(async (req, res) => {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized()
    }

    const token = authHeader.substring(7)
    const { verifyToken } = await import('../lib/auth.js')
    const userData = await verifyToken(token)

    if (!userData) {
      throw AppError.unauthorized('Invalid token')
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
}))

// POST /api/auth/change-password - Change user password (requires current password)
authRouter.post('/change-password', asyncHandler(async (req, res) => {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized()
    }

    const token = authHeader.substring(7)

    // Import verifyToken dynamically to avoid circular import
    const { verifyToken } = await import('../lib/auth.js')
    const userData = await verifyToken(token)

    if (!userData) {
      throw AppError.unauthorized('Invalid token')
    }

    const { currentPassword, newPassword, confirmPassword } = req.body

    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      throw AppError.badRequest('Current password, new password, and confirm password are required')
    }

    if (newPassword !== confirmPassword) {
      throw AppError.badRequest('New password and confirm password do not match')
    }

    if (newPassword.length < 8) {
      throw AppError.badRequest('New password must be at least 8 characters long')
    }

    // Get user with password hash
    const user = await prisma.user.findUnique({
      where: { id: userData.userId || userData.id },
      select: { id: true, passwordHash: true },
    })

    if (!user || !user.passwordHash) {
      throw AppError.notFound('User')
    }

    // Verify current password
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      throw AppError.unauthorized('Current password is incorrect')
    }

    // Hash and update password
    const newPasswordHash = hashPassword(newPassword)
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    })

    res.json({ message: 'Password changed successfully' })
}))

// POST /api/auth/verify-email - Verify email with token
authRouter.post('/verify-email', asyncHandler(async (req, res) => {
    const { token } = req.body

    if (!token) {
      throw AppError.badRequest('Verification token is required')
    }

    // Find the token
    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!verificationToken) {
      throw AppError.badRequest('Invalid verification token')
    }

    // Check if token has been used
    if (verificationToken.usedAt) {
      throw AppError.badRequest('This verification token has already been used')
    }

    // Check if token has expired
    if (verificationToken.expiresAt < new Date()) {
      throw AppError.badRequest('This verification token has expired')
    }

    // Check if user is already verified
    if (verificationToken.user.emailVerified) {
      throw AppError.badRequest('Email is already verified')
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

    res.json({
      message: 'Email verified successfully. You can now log in.',
      verified: true,
    })
}))

// GET /api/auth/verify-email-status - Check verification status
authRouter.get('/verify-email-status', asyncHandler(async (req, res) => {
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
}))

// POST /api/auth/resend-verification - Resend verification email
authRouter.post('/resend-verification', asyncHandler(async (req, res) => {
    const { email } = req.body

    if (!email) {
      throw AppError.badRequest('Email is required')
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, emailVerified: true, fullName: true },
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

    // Build verification URL using FRONTEND_URL
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5174'
    const verifyUrl = `${baseUrl}/verify-email?token=${verificationToken}`

    // Send verification email
    await sendVerificationEmail({
      to: user.email,
      userName: user.fullName || undefined,
      verificationUrl: verifyUrl,
      expiresInHours: 24,
    })

    res.json({
      message: 'If an account exists with this email, a new verification link has been sent.'
    })
}))

// POST /api/auth/test-expired-token - Generate an expired token for testing
// Only available in development
authRouter.post('/test-expired-token', asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    throw AppError.notFound('Resource')
  }

    const { email, password } = req.body

    if (!email || !password) {
      throw AppError.badRequest('Email and password are required')
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
      throw AppError.unauthorized('Invalid credentials')
    }

    if (!verifyPassword(password, user.passwordHash)) {
      throw AppError.unauthorized('Invalid credentials')
    }

    // Generate an expired token for testing
    const expiredToken = generateExpiredToken({
      userId: user.id,
      email: user.email,
      role: user.roleInCompany,
    })

    res.json({ expiredToken })
}))

// GET /api/auth/export-data - GDPR compliant data export
// Returns all user data in a portable JSON format
authRouter.get('/export-data', asyncHandler(async (req, res) => {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized()
    }

    const token = authHeader.substring(7)
    // Import verifyToken dynamically to avoid circular import
    const { verifyToken } = await import('../lib/auth.js')
    const userData = await verifyToken(token)

    if (!userData) {
      throw AppError.unauthorized('Invalid token')
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
      throw AppError.notFound('User')
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
}))

// POST /api/auth/register-and-accept-invitation - Register new user and accept subcontractor invitation
// This is a public endpoint (no auth required) for onboarding new subcontractor users
authRouter.post('/register-and-accept-invitation', asyncHandler(async (req, res) => {
    const { email, password, fullName, invitationId, tosAccepted } = req.body

    if (!email || !password || !invitationId) {
      throw AppError.badRequest('Email, password, and invitationId are required')
    }

    // Validate password strength
    const passwordValidation = validatePassword(password)
    if (!passwordValidation.valid) {
      throw AppError.badRequest('Password does not meet security requirements', {
        errors: passwordValidation.errors as unknown as Record<string, unknown>,
      })
    }

    // Require ToS acceptance
    if (!tosAccepted) {
      throw AppError.badRequest('You must accept the Terms of Service to create an account')
    }

    // Find the subcontractor company invitation
    const subcontractor = await prisma.subcontractorCompany.findUnique({
      where: { id: invitationId },
      include: {
        project: { select: { id: true, name: true } }
      }
    })

    if (!subcontractor) {
      throw AppError.notFound('Invitation not found or expired')
    }

    // Verify email matches the invitation (case-insensitive)
    if (subcontractor.primaryContactEmail?.toLowerCase() !== email.toLowerCase()) {
      throw AppError.badRequest('Email does not match the invitation')
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existingUser) {
      throw AppError.badRequest('An account with this email already exists. Please log in and accept the invitation.')
    }

    // Check if another user is already linked to this subcontractor company
    const existingLink = await prisma.subcontractorUser.findFirst({
      where: { subcontractorCompanyId: subcontractor.id }
    })

    if (existingLink) {
      throw AppError.badRequest('This invitation has already been accepted by another user')
    }

    // Create the user account
    const passwordHash = hashPassword(password)
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        fullName: fullName || subcontractor.primaryContactName || null,
        emailVerified: true, // Auto-verify since they're accepting an invitation
        roleInCompany: 'subcontractor_admin',
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        roleInCompany: true,
      },
    })

    // Record ToS acceptance
    await prisma.$executeRaw`UPDATE users SET tos_accepted_at = NOW(), tos_version = ${CURRENT_TOS_VERSION} WHERE id = ${user.id}`

    // Link user to subcontractor company
    await prisma.subcontractorUser.create({
      data: {
        userId: user.id,
        subcontractorCompanyId: subcontractor.id,
        role: 'admin' // First user is admin
      }
    })

    // Update subcontractor status to approved if pending
    if (subcontractor.status === 'pending_approval') {
      await prisma.subcontractorCompany.update({
        where: { id: subcontractor.id },
        data: { status: 'approved' }
      })
    }

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
      },
      company: {
        id: subcontractor.id,
        companyName: subcontractor.companyName,
        projectId: subcontractor.projectId,
        projectName: subcontractor.project.name,
      },
      token,
      message: 'Account created and invitation accepted successfully',
    })
}))

// GDPR Data Deletion endpoint
authRouter.delete('/delete-account', asyncHandler(async (req, res) => {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      throw AppError.unauthorized()
    }

    const token = authHeader.substring(7)
    const { verifyToken } = await import('../lib/auth.js')
    const userData = await verifyToken(token)

    if (!userData) {
      throw AppError.unauthorized('Invalid token')
    }

    const userId = userData.userId || userData.id

    // Get the confirmation password from request body
    const { password, confirmEmail } = req.body

    if (!confirmEmail) {
      throw AppError.badRequest('Email confirmation required')
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
      throw AppError.notFound('User')
    }

    // Verify email matches
    if (confirmEmail.toLowerCase() !== user.email.toLowerCase()) {
      throw AppError.badRequest('Email confirmation does not match')
    }

    // Verify password if the user has one set
    if (user.passwordHash && password) {
      const bcrypt = await import('bcryptjs')
      const isValidPassword = await bcrypt.compare(password, user.passwordHash)
      if (!isValidPassword) {
        throw AppError.badRequest('Invalid password')
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

    res.json({
      success: true,
      message: 'Your account and associated data have been permanently deleted.',
    })
}))

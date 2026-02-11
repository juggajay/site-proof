// MFA Routes (Feature #22, #420, #421)
// Two-factor authentication with TOTP (Time-based One-Time Password)

import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { verifyPassword } from '../lib/auth.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { generateSecret, verify as verifyOtp, generateURI } from 'otplib'
import QRCode from 'qrcode'
import { encrypt, decrypt } from '../lib/encryption.js'
import { AppError } from '../lib/AppError.js'
import { asyncHandler } from '../lib/asyncHandler.js'

export const mfaRouter = Router()

// GET /api/mfa/status - Get current MFA status for user
mfaRouter.get('/status', requireAuth, asyncHandler(async (req: any, res) => {
    const userId = req.user.userId

    // Use raw SQL to get MFA status
    const userResult = await prisma.$queryRaw<Array<{
      two_factor_enabled: boolean
    }>>`SELECT two_factor_enabled FROM users WHERE id = ${userId}`

    const user = userResult[0]
    if (!user) {
      throw AppError.notFound('User')
    }

    res.json({
      mfaEnabled: Boolean(user.two_factor_enabled),
    })
}))

// POST /api/mfa/setup - Generate MFA secret and QR code
mfaRouter.post('/setup', requireAuth, asyncHandler(async (req: any, res) => {
    const userId = req.user.userId
    const userEmail = req.user.email

    // Check if MFA is already enabled
    const userResult = await prisma.$queryRaw<Array<{
      two_factor_enabled: number
    }>>`SELECT two_factor_enabled FROM users WHERE id = ${userId}`

    const user = userResult[0]
    if (!user) {
      throw AppError.notFound('User')
    }

    if (user.two_factor_enabled) {
      throw AppError.badRequest('MFA is already enabled. Disable it first to set up again.')
    }

    // Generate a new secret using otplib v13 functional API
    const secret = await generateSecret()

    // Encrypt the secret before storing
    const encryptedSecret = encrypt(secret)

    // Store the encrypted secret temporarily (not enabled yet until verified)
    await prisma.$executeRaw`UPDATE users SET two_factor_secret = ${encryptedSecret} WHERE id = ${userId}`

    // Generate the otpauth URL using otplib v13 generateURI
    const otpAuthUrl = await generateURI({
      secret,
      issuer: 'SiteProof',
      label: userEmail,
    })

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl)

    res.json({
      secret,
      qrCode: qrCodeDataUrl,
      otpAuthUrl,
      message: 'Scan the QR code with your authenticator app, then verify with a code.',
    })
}))

// POST /api/mfa/verify-setup - Verify the setup code and enable MFA
mfaRouter.post('/verify-setup', requireAuth, asyncHandler(async (req: any, res) => {
    const userId = req.user.userId
    const { code } = req.body

    if (!code) {
      throw AppError.badRequest('Verification code is required')
    }

    // Get the user's pending secret
    const userResult = await prisma.$queryRaw<Array<{
      two_factor_secret: string | null
      two_factor_enabled: boolean
    }>>`SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = ${userId}`

    const user = userResult[0]
    if (!user) {
      throw AppError.notFound('User')
    }

    if (user.two_factor_enabled) {
      throw AppError.badRequest('MFA is already enabled')
    }

    if (!user.two_factor_secret) {
      throw AppError.badRequest('No MFA setup in progress. Please start setup first.')
    }

    // Decrypt the secret before verifying
    const decryptedSecret = decrypt(user.two_factor_secret)

    // Verify the code using otplib v13 functional API
    const isValid = await verifyOtp({
      token: code,
      secret: decryptedSecret,
    })

    if (!isValid) {
      throw AppError.badRequest('Invalid verification code. Please try again.')
    }

    // Enable MFA
    await prisma.$executeRaw`UPDATE users SET two_factor_enabled = TRUE WHERE id = ${userId}`

    // Generate backup codes (simple implementation - in production, use more secure method)
    const backupCodes = Array.from({ length: 8 }, () =>
      Math.random().toString(36).substring(2, 8).toUpperCase()
    )

    res.json({
      success: true,
      message: 'Two-factor authentication has been enabled successfully.',
      backupCodes,
    })
}))

// POST /api/mfa/disable - Disable MFA (requires password)
mfaRouter.post('/disable', requireAuth, asyncHandler(async (req: any, res) => {
    const userId = req.user.userId
    const { password, code } = req.body

    if (!password && !code) {
      throw AppError.badRequest('Password or MFA code is required to disable MFA')
    }

    // Get user details
    const userResult = await prisma.$queryRaw<Array<{
      password_hash: string | null
      two_factor_secret: string | null
      two_factor_enabled: boolean
    }>>`SELECT password_hash, two_factor_secret, two_factor_enabled FROM users WHERE id = ${userId}`

    const user = userResult[0]
    if (!user) {
      throw AppError.notFound('User')
    }

    if (!user.two_factor_enabled) {
      throw AppError.badRequest('MFA is not enabled')
    }

    // Verify either password or MFA code
    let verified = false

    if (password && user.password_hash) {
      verified = verifyPassword(password, user.password_hash)
    }

    if (!verified && code && user.two_factor_secret) {
      // Decrypt the secret before verifying
      const decryptedSecret = decrypt(user.two_factor_secret)
      const verifyResult = await verifyOtp({
        token: code,
        secret: decryptedSecret,
      })
      verified = typeof verifyResult === 'boolean' ? verifyResult : verifyResult.valid
    }

    if (!verified) {
      throw AppError.unauthorized('Invalid password or MFA code')
    }

    // Disable MFA and clear secret
    await prisma.$executeRaw`UPDATE users SET two_factor_enabled = FALSE, two_factor_secret = NULL WHERE id = ${userId}`

    res.json({
      success: true,
      message: 'Two-factor authentication has been disabled.',
    })
}))

// POST /api/mfa/verify - Verify MFA code during login
mfaRouter.post('/verify', asyncHandler(async (req, res) => {
    const { userId, code } = req.body

    if (!userId || !code) {
      throw AppError.badRequest('User ID and code are required')
    }

    // Get user's MFA secret
    const userResult = await prisma.$queryRaw<Array<{
      id: string
      email: string
      full_name: string | null
      role_in_company: string
      company_id: string | null
      two_factor_secret: string | null
      two_factor_enabled: boolean
    }>>`SELECT id, email, full_name, role_in_company, company_id, two_factor_secret, two_factor_enabled FROM users WHERE id = ${userId}`

    const user = userResult[0]
    if (!user) {
      throw AppError.notFound('User')
    }

    if (!user.two_factor_enabled || !user.two_factor_secret) {
      throw AppError.badRequest('MFA is not enabled for this user')
    }

    // Decrypt the secret before verifying
    const decryptedSecret = decrypt(user.two_factor_secret)

    // Verify the code using otplib v13 functional API
    const isValid = await verifyOtp({
      token: code,
      secret: decryptedSecret,
    })

    if (!isValid) {
      throw AppError.unauthorized('Invalid verification code')
    }

    // Return user info for token generation
    res.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role_in_company,
        companyId: user.company_id,
      },
    })
}))

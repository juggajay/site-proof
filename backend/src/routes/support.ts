import { Router, Request, Response } from 'express'
import { AppError } from '../lib/AppError.js'
import { asyncHandler } from '../lib/asyncHandler.js'

export const supportRouter = Router()

interface SupportRequest {
  subject: string
  message: string
  category: string
  userEmail?: string
  userName?: string
}

// POST /api/support/request - Submit a support request
supportRouter.post('/request', asyncHandler(async (req: Request, res: Response) => {
  const { subject, message }: SupportRequest = req.body

  if (!subject || !message) {
    throw AppError.badRequest('Subject and message are required')
  }

  // In a real application, this would:
  // 1. Store the support request in a database table
  // 2. Send an email notification to the support team
  // 3. Create a ticket in the support system
  // 4. Send a confirmation email to the user

  // Log support request without looking up user to prevent enumeration
  // The authenticated user context (if any) should be used instead of email lookup
  const ticketId = `SP-${Date.now()}`

  return res.status(200).json({
    success: true,
    message: 'Support request submitted successfully',
    ticketId,
  })
}))

// GET /api/support/contact - Get support contact information
supportRouter.get('/contact', (_req: Request, res: Response) => {
  res.json({
    email: 'support@siteproof.com.au',
    phone: '1800 748 377',
    phoneLabel: '1800 SITE PROOF',
    emergencyPhone: '0419 748 377',
    address: 'Level 10, 123 Construction Street, Sydney NSW 2000',
    hours: 'Mon-Fri, 8am-6pm AEST',
    responseTime: {
      critical: 'Within 2 hours',
      standard: 'Within 24 hours',
      general: 'Within 48 hours',
    },
  })
})

export default supportRouter

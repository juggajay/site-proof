import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma.js'

export const supportRouter = Router()

interface SupportRequest {
  subject: string
  message: string
  category: string
  userEmail?: string
  userName?: string
}

// POST /api/support/request - Submit a support request
supportRouter.post('/request', async (req: Request, res: Response) => {
  try {
    const { subject, message, category, userEmail }: SupportRequest = req.body

    if (!subject || !message) {
      return res.status(400).json({ message: 'Subject and message are required' })
    }

    // In a real application, this would:
    // 1. Store the support request in a database table
    // 2. Send an email notification to the support team
    // 3. Create a ticket in the support system
    // 4. Send a confirmation email to the user

    // Optional: Store in database if we have a SupportRequest model
    // For now, we'll create an activity log entry if user is authenticated
    if (userEmail) {
      try {
        const user = await prisma.user.findUnique({
          where: { email: userEmail },
        })

        if (user) {
          await prisma.auditLog.create({
            data: {
              userId: user.id,
              action: 'SUPPORT_REQUEST_SUBMITTED',
              entityType: 'support_request',
              entityId: `SP-${Date.now()}`,
              changes: JSON.stringify({
                subject,
                category,
                messagePreview: message.substring(0, 100),
              }),
            },
          })
        }
      } catch (logError) {
        // Don't fail the request if logging fails
        console.error('Failed to log support request activity:', logError)
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Support request submitted successfully',
      ticketId: `SP-${Date.now()}`, // Simulated ticket ID
    })
  } catch (error) {
    console.error('Support request error:', error)
    return res.status(500).json({ message: 'Failed to submit support request' })
  }
})

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

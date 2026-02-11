// NCR evidence: add, list, delete evidence attachments
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { type AuthUser } from '../../lib/auth.js'
import { requireAuth } from '../../middleware/authMiddleware.js'

const addEvidenceSchema = z.object({
  documentId: z.string().optional(),
  evidenceType: z.string().optional(),
  filename: z.string().optional(),
  fileUrl: z.string().optional(),
  fileSize: z.number().optional(),
  mimeType: z.string().optional(),
  caption: z.string().optional(),
  projectId: z.string().optional(),
})

export const ncrEvidenceRouter = Router()

// POST /api/ncrs/:id/evidence - Add evidence to NCR
ncrEvidenceRouter.post('/:id/evidence', requireAuth, async (req: any, res) => {
  try {
    const validation = addEvidenceSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues
      })
    }

    const user = req.user as AuthUser
    const { id } = req.params
    const { documentId, evidenceType, filename, fileUrl, fileSize, mimeType, caption, projectId: _providedProjectId } = validation.data

    const ncr = await prisma.nCR.findUnique({
      where: { id },
    })

    if (!ncr) {
      return res.status(404).json({ message: 'NCR not found' })
    }

    // Check access
    const projectUser = await prisma.projectUser.findFirst({
      where: {
        projectId: ncr.projectId,
        userId: user.userId,
      },
    })

    if (!projectUser) {
      return res.status(403).json({ message: 'Access denied' })
    }

    // If documentId is provided, link existing document
    // Otherwise, create a new document first
    let finalDocumentId = documentId

    if (!documentId) {
      // Create a new document for this evidence
      if (!filename || !fileUrl) {
        return res.status(400).json({ message: 'Either documentId or filename and fileUrl are required' })
      }

      const document = await prisma.document.create({
        data: {
          projectId: ncr.projectId,
          documentType: evidenceType || 'ncr_evidence',
          category: 'ncr_evidence',
          filename,
          fileUrl,
          fileSize,
          mimeType,
          uploadedById: user.userId,
          caption,
        },
      })
      finalDocumentId = document.id
    }

    // Create the NCR evidence link
    const evidence = await prisma.nCREvidence.create({
      data: {
        ncrId: id,
        documentId: finalDocumentId!,
        evidenceType: evidenceType || 'photo',
      },
      include: {
        document: {
          select: {
            id: true,
            filename: true,
            fileUrl: true,
            mimeType: true,
            uploadedAt: true,
          },
        },
      },
    })

    res.status(201).json({
      evidence,
      message: 'Evidence added to NCR successfully',
    })
  } catch (error) {
    console.error('Add NCR evidence error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// GET /api/ncrs/:id/evidence - List evidence for NCR
ncrEvidenceRouter.get('/:id/evidence', requireAuth, async (req: any, res) => {
  try {
    const user = req.user as AuthUser
    const { id } = req.params

    const ncr = await prisma.nCR.findUnique({
      where: { id },
    })

    if (!ncr) {
      return res.status(404).json({ message: 'NCR not found' })
    }

    // Check access
    const projectUser = await prisma.projectUser.findFirst({
      where: {
        projectId: ncr.projectId,
        userId: user.userId,
      },
    })

    if (!projectUser) {
      return res.status(403).json({ message: 'Access denied' })
    }

    const evidence = await prisma.nCREvidence.findMany({
      where: { ncrId: id },
      include: {
        document: {
          select: {
            id: true,
            filename: true,
            fileUrl: true,
            mimeType: true,
            fileSize: true,
            uploadedAt: true,
            uploadedBy: { select: { fullName: true, email: true } },
            caption: true,
          },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    })

    // Group by evidence type
    const grouped = {
      photos: evidence.filter(e => e.evidenceType === 'photo'),
      certificates: evidence.filter(e => e.evidenceType === 'certificate' || e.evidenceType === 'retest_certificate'),
      documents: evidence.filter(e => !['photo', 'certificate', 'retest_certificate'].includes(e.evidenceType)),
      all: evidence,
    }

    res.json({
      evidence: grouped.all,
      grouped,
      count: evidence.length,
    })
  } catch (error) {
    console.error('List NCR evidence error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// DELETE /api/ncrs/:id/evidence/:evidenceId - Remove evidence from NCR
ncrEvidenceRouter.delete('/:id/evidence/:evidenceId', requireAuth, async (req: any, res) => {
  try {
    const user = req.user as AuthUser
    const { id, evidenceId } = req.params

    const ncr = await prisma.nCR.findUnique({
      where: { id },
    })

    if (!ncr) {
      return res.status(404).json({ message: 'NCR not found' })
    }

    // Check access
    const projectUser = await prisma.projectUser.findFirst({
      where: {
        projectId: ncr.projectId,
        userId: user.userId,
      },
    })

    if (!projectUser) {
      return res.status(403).json({ message: 'Access denied' })
    }

    // Check if NCR is not closed
    if (ncr.status === 'closed' || ncr.status === 'closed_concession') {
      return res.status(400).json({ message: 'Cannot remove evidence from a closed NCR' })
    }

    await prisma.nCREvidence.delete({
      where: { id: evidenceId },
    })

    res.json({ message: 'Evidence removed successfully' })
  } catch (error) {
    console.error('Remove NCR evidence error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

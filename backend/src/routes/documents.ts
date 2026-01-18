// Feature #248: Documents API routes
import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { requireAuth } from '../middleware/authMiddleware.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

const prisma = new PrismaClient()
const router = Router()

// Apply auth middleware
router.use(requireAuth)

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), 'uploads', 'documents')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + '-' + file.originalname)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    // Accept common document and image types
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ]
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type'))
    }
  }
})

// Helper to check project access
async function checkProjectAccess(userId: string, projectId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return false

  if (user.roleInCompany === 'admin' || user.roleInCompany === 'owner') {
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    return project?.companyId === user.companyId
  }

  const projectUser = await prisma.projectUser.findUnique({
    where: { projectId_userId: { projectId, userId } }
  })
  return !!projectUser
}

// Schemas
const createDocumentSchema = z.object({
  projectId: z.string(),
  lotId: z.string().optional(),
  documentType: z.string().min(1),
  category: z.string().optional(),
  caption: z.string().optional(),
  tags: z.string().optional(),
})

// GET /api/documents/:projectId - List documents for a project
router.get('/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params
    const { category, documentType, lotId, search } = req.query
    const userId = (req as any).user?.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const hasAccess = await checkProjectAccess(userId, projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const where: any = { projectId }
    if (category) where.category = category
    if (documentType) where.documentType = documentType
    if (lotId) where.lotId = lotId

    let documents = await prisma.document.findMany({
      where,
      include: {
        lot: { select: { id: true, lotNumber: true, description: true } },
        uploadedBy: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { uploadedAt: 'desc' },
    })

    // Filter by search term if provided
    if (search && typeof search === 'string' && search.trim()) {
      const searchLower = search.toLowerCase().trim()
      documents = documents.filter(doc =>
        doc.filename.toLowerCase().includes(searchLower) ||
        doc.caption?.toLowerCase().includes(searchLower) ||
        doc.category?.toLowerCase().includes(searchLower) ||
        doc.documentType.toLowerCase().includes(searchLower) ||
        doc.lot?.lotNumber.toLowerCase().includes(searchLower)
      )
    }

    // Group by category for convenience
    const categories: Record<string, number> = {}
    for (const doc of documents) {
      const cat = doc.category || 'Uncategorized'
      categories[cat] = (categories[cat] || 0) + 1
    }

    res.json({
      documents,
      total: documents.length,
      categories,
    })
  } catch (error) {
    console.error('Error fetching documents:', error)
    res.status(500).json({ error: 'Failed to fetch documents' })
  }
})

// POST /api/documents/upload - Upload a document
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const { projectId, lotId, documentType, category, caption, tags } = req.body

    if (!projectId || !documentType) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path)
      return res.status(400).json({ error: 'projectId and documentType are required' })
    }

    const hasAccess = await checkProjectAccess(userId, projectId)
    if (!hasAccess) {
      fs.unlinkSync(req.file.path)
      return res.status(403).json({ error: 'Access denied' })
    }

    // Create document record
    const document = await prisma.document.create({
      data: {
        projectId,
        lotId: lotId || null,
        documentType,
        category: category || null,
        filename: req.file.originalname,
        fileUrl: `/uploads/documents/${req.file.filename}`,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedById: userId,
        caption: caption || null,
        tags: tags || null,
      },
      include: {
        lot: { select: { id: true, lotNumber: true } },
        uploadedBy: { select: { id: true, fullName: true, email: true } },
      },
    })

    res.status(201).json(document)
  } catch (error) {
    console.error('Error uploading document:', error)
    res.status(500).json({ error: 'Failed to upload document' })
  }
})

// GET /api/documents/file/:documentId - Get document file
router.get('/file/:documentId', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params
    const userId = (req as any).user?.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      return res.status(404).json({ error: 'Document not found' })
    }

    const hasAccess = await checkProjectAccess(userId, document.projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const filePath = path.join(process.cwd(), document.fileUrl)
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' })
    }

    res.sendFile(filePath)
  } catch (error) {
    console.error('Error fetching document file:', error)
    res.status(500).json({ error: 'Failed to fetch document file' })
  }
})

// DELETE /api/documents/:documentId - Delete a document
router.delete('/:documentId', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params
    const userId = (req as any).user?.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      return res.status(404).json({ error: 'Document not found' })
    }

    const hasAccess = await checkProjectAccess(userId, document.projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Delete file from disk
    const filePath = path.join(process.cwd(), document.fileUrl)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    // Delete database record
    await prisma.document.delete({ where: { id: documentId } })

    res.status(204).send()
  } catch (error) {
    console.error('Error deleting document:', error)
    res.status(500).json({ error: 'Failed to delete document' })
  }
})

// PATCH /api/documents/:documentId - Update document metadata
router.patch('/:documentId', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params
    const { lotId, category, caption, tags, isFavourite } = req.body
    const userId = (req as any).user?.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      return res.status(404).json({ error: 'Document not found' })
    }

    const hasAccess = await checkProjectAccess(userId, document.projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: {
        lotId: lotId !== undefined ? (lotId || null) : undefined,
        category: category !== undefined ? category : undefined,
        caption: caption !== undefined ? caption : undefined,
        tags: tags !== undefined ? tags : undefined,
        isFavourite: isFavourite !== undefined ? isFavourite : undefined,
      },
      include: {
        lot: { select: { id: true, lotNumber: true } },
        uploadedBy: { select: { id: true, fullName: true, email: true } },
      },
    })

    res.json(updatedDocument)
  } catch (error) {
    console.error('Error updating document:', error)
    res.status(500).json({ error: 'Failed to update document' })
  }
})

export default router

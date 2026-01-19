// Feature #250: Drawing Register API routes
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

// Configure multer for drawing file uploads
const uploadDir = path.join(process.cwd(), 'uploads', 'drawings')
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
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for drawings
  fileFilter: (req, file, cb) => {
    // Accept common drawing types
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/tiff',
      'application/dxf',
      'application/dwg',
      'application/vnd.dwg',
    ]
    // Also accept by extension for CAD files
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowedTypes.includes(file.mimetype) || ['.pdf', '.dwg', '.dxf', '.jpg', '.jpeg', '.png', '.tiff', '.tif'].includes(ext)) {
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

// GET /api/drawings/:projectId - List drawings for a project
router.get('/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params
    const { status, search, revision } = req.query
    const userId = (req as any).user?.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const hasAccess = await checkProjectAccess(userId, projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const where: any = { projectId }
    if (status) where.status = status

    let drawings = await prisma.drawing.findMany({
      where,
      include: {
        document: {
          select: {
            id: true,
            filename: true,
            fileUrl: true,
            fileSize: true,
            mimeType: true,
            uploadedAt: true,
            uploadedBy: { select: { id: true, fullName: true, email: true } },
          }
        },
        supersededBy: { select: { id: true, drawingNumber: true, revision: true } },
        supersedes: { select: { id: true, drawingNumber: true, revision: true } },
      },
      orderBy: [{ drawingNumber: 'asc' }, { revision: 'desc' }],
    })

    // Filter by search term if provided
    if (search && typeof search === 'string' && search.trim()) {
      const searchLower = search.toLowerCase().trim()
      drawings = drawings.filter(drw =>
        drw.drawingNumber.toLowerCase().includes(searchLower) ||
        drw.title?.toLowerCase().includes(searchLower) ||
        drw.revision?.toLowerCase().includes(searchLower)
      )
    }

    // Filter by revision if provided
    if (revision && typeof revision === 'string') {
      drawings = drawings.filter(drw => drw.revision === revision)
    }

    // Summary stats
    const stats = {
      total: drawings.length,
      preliminary: drawings.filter(d => d.status === 'preliminary').length,
      forConstruction: drawings.filter(d => d.status === 'for_construction').length,
      asBuilt: drawings.filter(d => d.status === 'as_built').length,
    }

    res.json({
      drawings,
      stats,
    })
  } catch (error) {
    console.error('Error fetching drawings:', error)
    res.status(500).json({ error: 'Failed to fetch drawings' })
  }
})

// POST /api/drawings - Create a new drawing with file upload
router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const { projectId, drawingNumber, title, revision, issueDate, status } = req.body

    if (!projectId || !drawingNumber) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path)
      return res.status(400).json({ error: 'projectId and drawingNumber are required' })
    }

    const hasAccess = await checkProjectAccess(userId, projectId)
    if (!hasAccess) {
      fs.unlinkSync(req.file.path)
      return res.status(403).json({ error: 'Access denied' })
    }

    // Check for duplicate drawing number + revision
    const existing = await prisma.drawing.findFirst({
      where: {
        projectId,
        drawingNumber,
        revision: revision || null,
      }
    })

    if (existing) {
      fs.unlinkSync(req.file.path)
      return res.status(400).json({ error: 'Drawing with this number and revision already exists' })
    }

    // Create the document first
    const document = await prisma.document.create({
      data: {
        projectId,
        documentType: 'drawing',
        filename: req.file.originalname,
        fileUrl: `/uploads/drawings/${req.file.filename}`,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedById: userId,
      }
    })

    // Create the drawing record
    const drawing = await prisma.drawing.create({
      data: {
        projectId,
        documentId: document.id,
        drawingNumber,
        title: title || null,
        revision: revision || null,
        issueDate: issueDate ? new Date(issueDate) : null,
        status: status || 'preliminary',
      },
      include: {
        document: {
          select: {
            id: true,
            filename: true,
            fileUrl: true,
            fileSize: true,
            mimeType: true,
            uploadedAt: true,
            uploadedBy: { select: { id: true, fullName: true, email: true } },
          }
        },
      },
    })

    res.status(201).json(drawing)
  } catch (error) {
    console.error('Error creating drawing:', error)
    res.status(500).json({ error: 'Failed to create drawing' })
  }
})

// PATCH /api/drawings/:drawingId - Update drawing metadata
router.patch('/:drawingId', async (req: Request, res: Response) => {
  try {
    const { drawingId } = req.params
    const { title, revision, issueDate, status, supersededById } = req.body
    const userId = (req as any).user?.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const drawing = await prisma.drawing.findUnique({
      where: { id: drawingId },
    })

    if (!drawing) {
      return res.status(404).json({ error: 'Drawing not found' })
    }

    const hasAccess = await checkProjectAccess(userId, drawing.projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const updatedDrawing = await prisma.drawing.update({
      where: { id: drawingId },
      data: {
        title: title !== undefined ? title : undefined,
        revision: revision !== undefined ? revision : undefined,
        issueDate: issueDate !== undefined ? (issueDate ? new Date(issueDate) : null) : undefined,
        status: status !== undefined ? status : undefined,
        supersededById: supersededById !== undefined ? (supersededById || null) : undefined,
      },
      include: {
        document: {
          select: {
            id: true,
            filename: true,
            fileUrl: true,
            fileSize: true,
            mimeType: true,
            uploadedAt: true,
            uploadedBy: { select: { id: true, fullName: true, email: true } },
          }
        },
        supersededBy: { select: { id: true, drawingNumber: true, revision: true } },
      },
    })

    res.json(updatedDrawing)
  } catch (error) {
    console.error('Error updating drawing:', error)
    res.status(500).json({ error: 'Failed to update drawing' })
  }
})

// DELETE /api/drawings/:drawingId - Delete a drawing
router.delete('/:drawingId', async (req: Request, res: Response) => {
  try {
    const { drawingId } = req.params
    const userId = (req as any).user?.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const drawing = await prisma.drawing.findUnique({
      where: { id: drawingId },
      include: { document: true }
    })

    if (!drawing) {
      return res.status(404).json({ error: 'Drawing not found' })
    }

    const hasAccess = await checkProjectAccess(userId, drawing.projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Delete file from disk
    const filePath = path.join(process.cwd(), drawing.document.fileUrl)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    // Delete drawing record (document will remain for audit purposes, or delete it too)
    await prisma.drawing.delete({ where: { id: drawingId } })
    // Optionally delete the document as well
    await prisma.document.delete({ where: { id: drawing.documentId } })

    res.status(204).send()
  } catch (error) {
    console.error('Error deleting drawing:', error)
    res.status(500).json({ error: 'Failed to delete drawing' })
  }
})

// POST /api/drawings/:drawingId/supersede - Create a new revision that supersedes this drawing
router.post('/:drawingId/supersede', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { drawingId } = req.params
    const userId = (req as any).user?.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const oldDrawing = await prisma.drawing.findUnique({
      where: { id: drawingId },
    })

    if (!oldDrawing) {
      fs.unlinkSync(req.file.path)
      return res.status(404).json({ error: 'Drawing not found' })
    }

    const hasAccess = await checkProjectAccess(userId, oldDrawing.projectId)
    if (!hasAccess) {
      fs.unlinkSync(req.file.path)
      return res.status(403).json({ error: 'Access denied' })
    }

    const { title, revision, issueDate, status } = req.body

    if (!revision) {
      fs.unlinkSync(req.file.path)
      return res.status(400).json({ error: 'New revision is required' })
    }

    // Create document
    const document = await prisma.document.create({
      data: {
        projectId: oldDrawing.projectId,
        documentType: 'drawing',
        filename: req.file.originalname,
        fileUrl: `/uploads/drawings/${req.file.filename}`,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedById: userId,
      }
    })

    // Create new drawing that supersedes the old one
    const newDrawing = await prisma.drawing.create({
      data: {
        projectId: oldDrawing.projectId,
        documentId: document.id,
        drawingNumber: oldDrawing.drawingNumber,
        title: title || oldDrawing.title,
        revision: revision,
        issueDate: issueDate ? new Date(issueDate) : null,
        status: status || 'for_construction',
      },
      include: {
        document: {
          select: {
            id: true,
            filename: true,
            fileUrl: true,
            fileSize: true,
            mimeType: true,
            uploadedAt: true,
            uploadedBy: { select: { id: true, fullName: true, email: true } },
          }
        },
      },
    })

    // Update old drawing to mark it as superseded
    await prisma.drawing.update({
      where: { id: drawingId },
      data: { supersededById: newDrawing.id }
    })

    res.status(201).json(newDrawing)
  } catch (error) {
    console.error('Error superseding drawing:', error)
    res.status(500).json({ error: 'Failed to supersede drawing' })
  }
})

// GET /api/drawings/:projectId/current-set - Get current (non-superseded) drawings for download
router.get('/:projectId/current-set', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params
    const userId = (req as any).user?.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const hasAccess = await checkProjectAccess(userId, projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Get all current (non-superseded) drawings
    const currentDrawings = await prisma.drawing.findMany({
      where: {
        projectId,
        supersededById: null, // Only current versions (not superseded)
      },
      include: {
        document: {
          select: {
            id: true,
            filename: true,
            fileUrl: true,
            fileSize: true,
            mimeType: true,
          }
        },
      },
      orderBy: [{ drawingNumber: 'asc' }, { revision: 'desc' }],
    })

    // Return the list of current drawings with download info
    res.json({
      drawings: currentDrawings.map(d => ({
        id: d.id,
        drawingNumber: d.drawingNumber,
        title: d.title,
        revision: d.revision,
        status: d.status,
        fileUrl: d.document.fileUrl,
        filename: d.document.filename,
        fileSize: d.document.fileSize,
      })),
      totalCount: currentDrawings.length,
      totalSize: currentDrawings.reduce((sum, d) => sum + (d.document.fileSize || 0), 0),
    })
  } catch (error) {
    console.error('Error fetching current drawings set:', error)
    res.status(500).json({ error: 'Failed to fetch current drawings set' })
  }
})

export const drawingsRouter = router

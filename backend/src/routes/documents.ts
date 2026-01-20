// Feature #248: Documents API routes
import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { requireAuth } from '../middleware/authMiddleware.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import exifr from 'exifr'

const prisma = new PrismaClient()

// Feature #479: Extract EXIF metadata from image files
async function extractPhotoMetadata(filePath: string, mimeType: string): Promise<{
  gpsLatitude?: number
  gpsLongitude?: number
  captureTimestamp?: Date
  deviceInfo?: string
}> {
  // Only process image files
  if (!mimeType || !mimeType.startsWith('image/')) {
    return {}
  }

  try {
    const exifData = await exifr.parse(filePath, {
      gps: true,
      pick: ['DateTimeOriginal', 'CreateDate', 'GPSLatitude', 'GPSLongitude', 'Make', 'Model', 'Software']
    })

    if (!exifData) {
      return {}
    }

    const result: {
      gpsLatitude?: number
      gpsLongitude?: number
      captureTimestamp?: Date
      deviceInfo?: string
    } = {}

    // Extract GPS coordinates
    if (exifData.GPSLatitude !== undefined && exifData.GPSLongitude !== undefined) {
      result.gpsLatitude = exifData.latitude || exifData.GPSLatitude
      result.gpsLongitude = exifData.longitude || exifData.GPSLongitude
    }

    // Extract capture timestamp
    if (exifData.DateTimeOriginal) {
      result.captureTimestamp = new Date(exifData.DateTimeOriginal)
    } else if (exifData.CreateDate) {
      result.captureTimestamp = new Date(exifData.CreateDate)
    }

    // Extract device info
    const deviceParts: string[] = []
    if (exifData.Make) deviceParts.push(exifData.Make)
    if (exifData.Model) deviceParts.push(exifData.Model)
    if (exifData.Software) deviceParts.push(`(${exifData.Software})`)
    if (deviceParts.length > 0) {
      result.deviceInfo = deviceParts.join(' ')
    }

    return result
  } catch (error) {
    console.error('Error extracting EXIF metadata:', error)
    return {}
  }
}
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

  // For admin/owner users, check if project belongs to their company
  if (user.roleInCompany === 'admin' || user.roleInCompany === 'owner') {
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (project?.companyId === user.companyId) {
      return true
    }
    // Fall through to check ProjectUser if company doesn't match
  }

  // Check if user has explicit access via ProjectUser record
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
    const { category, documentType, lotId, search, dateFrom, dateTo } = req.query
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

    // Feature #249: Date range filtering
    if (dateFrom || dateTo) {
      where.uploadedAt = {}
      if (dateFrom && typeof dateFrom === 'string') {
        where.uploadedAt.gte = new Date(dateFrom)
      }
      if (dateTo && typeof dateTo === 'string') {
        // Include entire end day by setting to end of day
        const endDate = new Date(dateTo)
        endDate.setHours(23, 59, 59, 999)
        where.uploadedAt.lte = endDate
      }
    }

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

    // Feature #479: Extract EXIF metadata for images
    const photoMetadata = await extractPhotoMetadata(req.file.path, req.file.mimetype)

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
        // Feature #479: Store extracted EXIF data
        gpsLatitude: photoMetadata.gpsLatitude,
        gpsLongitude: photoMetadata.gpsLongitude,
        captureTimestamp: photoMetadata.captureTimestamp,
        // Store device info in aiClassification field as metadata
        aiClassification: photoMetadata.deviceInfo ? JSON.stringify({ deviceInfo: photoMetadata.deviceInfo }) : null,
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

// Feature #247: AI Photo Classification
// POST /api/documents/:documentId/classify - Classify a photo using AI
router.post('/:documentId/classify', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params
    const userId = (req as any).user?.id

    console.log('[AI Classification] Starting classification:', { documentId, userId })

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      console.log('[AI Classification] Document not found:', documentId)
      return res.status(404).json({ error: 'Document not found' })
    }

    console.log('[AI Classification] Document found:', { documentId, projectId: document.projectId })
    const hasAccess = await checkProjectAccess(userId, document.projectId)
    console.log('[AI Classification] Access check result:', { hasAccess, userId, projectId: document.projectId })
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied', debug: { userId, projectId: document.projectId } })
    }

    // Only classify images
    const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

    // Determine mimeType from document or extract from base64 data URL
    let mimeType = document.mimeType
    if (!mimeType && document.fileUrl?.startsWith('data:')) {
      const dataUrlMatch = document.fileUrl.match(/^data:([^;]+);base64,/)
      if (dataUrlMatch) {
        mimeType = dataUrlMatch[1]
      }
    }

    if (!mimeType || !imageTypes.includes(mimeType)) {
      return res.status(400).json({ error: 'Only image files can be classified' })
    }

    // Classification categories for civil construction
    const CLASSIFICATION_CATEGORIES = [
      'Survey',
      'Compaction',
      'Material Delivery',
      'Excavation',
      'Formwork',
      'Concrete Pour',
      'Pipe Laying',
      'General Progress',
      'Inspection',
      'Testing',
      'Safety',
      'Plant/Equipment'
    ]

    let suggestedClassification: string
    let confidence: number

    // Try to use real AI classification if API key is available
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY
    if (anthropicApiKey && anthropicApiKey !== 'sk-placeholder') {
      try {
        let base64Image: string
        const mediaType = mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

        // Check if fileUrl is a base64 data URL or a file path
        if (document.fileUrl.startsWith('data:')) {
          // Extract base64 data from data URL
          const base64Match = document.fileUrl.match(/^data:[^;]+;base64,(.+)$/)
          if (!base64Match) {
            return res.status(400).json({ error: 'Invalid base64 data URL format' })
          }
          base64Image = base64Match[1]
        } else {
          // Read from file path
          const filePath = path.join(process.cwd(), document.fileUrl)
          if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Image file not found on server' })
          }
          const imageData = fs.readFileSync(filePath)
          base64Image = imageData.toString('base64')
        }

        // Call Anthropic API for image classification
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicApiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 100,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: mediaType,
                      data: base64Image
                    }
                  },
                  {
                    type: 'text',
                    text: `Classify this civil construction photo into exactly ONE of these categories: ${CLASSIFICATION_CATEGORIES.join(', ')}.

Respond with ONLY the category name (exactly as written above) followed by a confidence percentage (0-100).
Format: CategoryName|Confidence

Example responses:
Compaction|95
Excavation|80
General Progress|60`
                  }
                ]
              }
            ]
          })
        })

        if (response.ok) {
          const result = await response.json() as { content: { type: string; text: string }[] }
          const aiResponse = result.content[0]?.text?.trim() || ''
          const [category, confidenceStr] = aiResponse.split('|')

          // Validate the category
          const matchedCategory = CLASSIFICATION_CATEGORIES.find(
            c => c.toLowerCase() === category?.toLowerCase().trim()
          )

          if (matchedCategory) {
            suggestedClassification = matchedCategory
            confidence = parseInt(confidenceStr) || 70
          } else {
            // Fallback if AI response doesn't match expected format
            suggestedClassification = 'General Progress'
            confidence = 50
          }
        } else {
          throw new Error('Anthropic API request failed')
        }
      } catch (aiError) {
        console.error('AI classification error:', aiError)
        // Fall back to simulated classification
        suggestedClassification = simulateClassification(document.filename, document.caption)
        confidence = 65
      }
    } else {
      // Use simulated classification when no API key
      suggestedClassification = simulateClassification(document.filename, document.caption)
      confidence = 70
    }

    res.json({
      documentId,
      suggestedClassification,
      confidence,
      categories: CLASSIFICATION_CATEGORIES
    })
  } catch (error) {
    console.error('Error classifying photo:', error)
    res.status(500).json({ error: 'Failed to classify photo' })
  }
})

// Helper function to simulate AI classification based on filename/caption keywords
function simulateClassification(filename: string, caption: string | null): string {
  const text = `${filename} ${caption || ''}`.toLowerCase()

  // Keyword-based classification
  if (text.includes('survey') || text.includes('level') || text.includes('gps') || text.includes('theodolite')) {
    return 'Survey'
  }
  if (text.includes('compact') || text.includes('roller') || text.includes('density') || text.includes('proctor')) {
    return 'Compaction'
  }
  if (text.includes('delivery') || text.includes('truck') || text.includes('material') || text.includes('stockpile')) {
    return 'Material Delivery'
  }
  if (text.includes('excavat') || text.includes('dig') || text.includes('trench') || text.includes('dozer')) {
    return 'Excavation'
  }
  if (text.includes('form') || text.includes('boxing') || text.includes('rebar') || text.includes('reinforce')) {
    return 'Formwork'
  }
  if (text.includes('concrete') || text.includes('pour') || text.includes('slump') || text.includes('agitator')) {
    return 'Concrete Pour'
  }
  if (text.includes('pipe') || text.includes('culvert') || text.includes('drain') || text.includes('stormwater')) {
    return 'Pipe Laying'
  }
  if (text.includes('inspect') || text.includes('check') || text.includes('review')) {
    return 'Inspection'
  }
  if (text.includes('test') || text.includes('sample') || text.includes('lab')) {
    return 'Testing'
  }
  if (text.includes('safety') || text.includes('ppe') || text.includes('hazard') || text.includes('sign')) {
    return 'Safety'
  }
  if (text.includes('plant') || text.includes('machine') || text.includes('equipment') || text.includes('excavator')) {
    return 'Plant/Equipment'
  }

  // Default to General Progress
  return 'General Progress'
}

// POST /api/documents/:documentId/save-classification - Save the classification
router.post('/:documentId/save-classification', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params
    const { classification } = req.body
    const userId = (req as any).user?.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (!classification) {
      return res.status(400).json({ error: 'Classification is required' })
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

    // Update the document with the classification
    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: {
        aiClassification: classification
      },
      include: {
        lot: { select: { id: true, lotNumber: true } },
        uploadedBy: { select: { id: true, fullName: true, email: true } },
      },
    })

    res.json(updatedDocument)
  } catch (error) {
    console.error('Error saving classification:', error)
    res.status(500).json({ error: 'Failed to save classification' })
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

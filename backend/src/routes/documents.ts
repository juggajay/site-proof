// Feature #248: Documents API routes
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { AppError } from '../lib/AppError.js'
import { asyncHandler } from '../lib/asyncHandler.js'
import { parsePagination, getPrismaSkipTake, getPaginationMeta } from '../lib/pagination.js'
import { supabase, isSupabaseConfigured, getSupabasePublicUrl, DOCUMENTS_BUCKET } from '../lib/supabase.js'
import { checkProjectAccess } from '../lib/projectAccess.js'
import { createAuditLog, AuditAction } from '../lib/auditLog.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import exifr from 'exifr'
import crypto from 'crypto'

// Feature #741: Signed URL system for secure file downloads
// Store signed URL tokens with expiration times
interface SignedUrlToken {
  documentId: string
  userId: string
  expiresAt: Date
  createdAt: Date
}

const signedUrlTokens: Map<string, SignedUrlToken> = new Map()

// Clean expired tokens periodically (every 5 minutes)
setInterval(() => {
  const now = new Date()
  for (const [token, data] of signedUrlTokens.entries()) {
    if (data.expiresAt < now) {
      signedUrlTokens.delete(token)
    }
  }
}, 5 * 60 * 1000)

// Generate a signed URL token
function generateSignedUrlToken(documentId: string, userId: string, expiresInMinutes: number = 15): string {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000)

  signedUrlTokens.set(token, {
    documentId,
    userId,
    expiresAt,
    createdAt: new Date()
  })

  return token
}

// Validate a signed URL token
function validateSignedUrlToken(token: string, documentId: string): { valid: boolean; expired?: boolean; userId?: string } {
  const data = signedUrlTokens.get(token)

  if (!data) {
    return { valid: false }
  }

  if (data.documentId !== documentId) {
    return { valid: false }
  }

  if (data.expiresAt < new Date()) {
    signedUrlTokens.delete(token)
    return { valid: false, expired: true }
  }

  return { valid: true, userId: data.userId }
}

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

// Feature #741: Public route for signed URL download (no auth required)
// This MUST be defined BEFORE the requireAuth middleware
router.get('/download/:documentId', asyncHandler(async (req: Request, res: Response) => {
    const { documentId } = req.params
    const { token } = req.query

    if (!token || typeof token !== 'string') {
      throw AppError.badRequest('Token is required', { message: 'Please provide a valid signed URL token' })
    }

    // Validate the signed token
    const validation = validateSignedUrlToken(token, documentId)

    if (!validation.valid) {
      if (validation.expired) {
        throw new AppError(410, 'This signed URL has expired. Please request a new one.', 'URL_EXPIRED')
      }
      throw AppError.forbidden('The signed URL token is invalid or does not match this document.')
    }

    // Get document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      throw AppError.notFound('Document')
    }

    const filePath = path.join(process.cwd(), 'uploads', 'documents', path.basename(document.fileUrl))
    if (!fs.existsSync(filePath)) {
      // Try alternative path structure
      const altPath = path.join(process.cwd(), document.fileUrl)
      if (!fs.existsSync(altPath)) {
        throw AppError.notFound('File')
      }
      // Set content disposition header for download
      res.setHeader('Content-Disposition', `attachment; filename="${document.filename}"`)
      res.setHeader('Content-Type', document.mimeType || 'application/octet-stream')
      return res.sendFile(altPath)
    }

    // Set content disposition header for download
    res.setHeader('Content-Disposition', `attachment; filename="${document.filename}"`)
    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream')

    res.sendFile(filePath)
}))

// Feature #741: Public route for token validation (no auth required)
router.get('/signed-url/validate', asyncHandler(async (req: Request, res: Response) => {
    const { token, documentId } = req.query

    if (!token || typeof token !== 'string') {
      throw AppError.badRequest('Token is required')
    }

    if (!documentId || typeof documentId !== 'string') {
      throw AppError.badRequest('Document ID is required')
    }

    const validation = validateSignedUrlToken(token, documentId)

    if (!validation.valid) {
      return res.json({
        valid: false,
        expired: validation.expired || false,
        message: validation.expired ? 'Token has expired' : 'Token is invalid'
      })
    }

    // Get token data for response
    const tokenData = signedUrlTokens.get(token)

    res.json({
      valid: true,
      expired: false,
      documentId,
      expiresAt: tokenData?.expiresAt.toISOString(),
      createdAt: tokenData?.createdAt.toISOString(),
      message: 'Token is valid'
    })
}))

// Apply auth middleware for all subsequent routes
router.use(requireAuth)

// Configure multer for file uploads
// Use memory storage when Supabase is configured, disk storage as fallback
const uploadDir = path.join(process.cwd(), 'uploads', 'documents')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir)
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + '-' + file.originalname)
  }
})

// Use memory storage for Supabase uploads
const memoryStorage = multer.memoryStorage()

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

// Use memory storage when Supabase is configured for cloud uploads
const upload = multer({
  storage: isSupabaseConfigured() ? memoryStorage : diskStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (_req, file, cb) => {
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type'))
    }
  }
})

// Helper to upload file to Supabase Storage
async function uploadToSupabase(
  file: Express.Multer.File,
  projectId: string
): Promise<{ url: string; storagePath: string }> {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
  const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')
  const storagePath = `${projectId}/${uniqueSuffix}-${sanitizedFilename}`

  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    })

  if (error) {
    console.error('Supabase upload error:', error)
    throw new Error(`Failed to upload to Supabase: ${error.message}`)
  }

  const url = getSupabasePublicUrl(DOCUMENTS_BUCKET, storagePath)
  return { url, storagePath }
}

// Helper to delete file from Supabase Storage
async function deleteFromSupabase(fileUrl: string): Promise<void> {
  // Extract storage path from URL
  const urlParts = fileUrl.split(`/storage/v1/object/public/${DOCUMENTS_BUCKET}/`)
  if (urlParts.length !== 2) {
    console.warn('Could not extract storage path from URL:', fileUrl)
    return
  }

  const storagePath = decodeURIComponent(urlParts[1])
  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .remove([storagePath])

  if (error) {
    console.error('Supabase delete error:', error)
  }
}

// GET /api/documents/:projectId - List documents for a project
router.get('/:projectId', asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params
    const { category, documentType, lotId, search, dateFrom, dateTo } = req.query
    const userId = req.user!.id

    if (!userId) {
      throw AppError.unauthorized()
    }

    const hasAccess = await checkProjectAccess(userId, projectId)
    if (!hasAccess) {
      throw AppError.forbidden('Access denied')
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

    // Push search filtering to database
    if (search && typeof search === 'string' && search.trim()) {
      const searchTerm = search.trim()
      where.OR = [
        { filename: { contains: searchTerm, mode: 'insensitive' } },
        { caption: { contains: searchTerm, mode: 'insensitive' } },
        { category: { contains: searchTerm, mode: 'insensitive' } },
        { documentType: { contains: searchTerm, mode: 'insensitive' } },
      ]
    }

    const pagination = parsePagination(req.query)
    const { skip, take } = getPrismaSkipTake(pagination.page, pagination.limit)

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        include: {
          lot: { select: { id: true, lotNumber: true, description: true } },
          uploadedBy: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { uploadedAt: 'desc' },
        skip,
        take,
      }),
      prisma.document.count({ where }),
    ])

    // Group by category for convenience
    const categories: Record<string, number> = {}
    for (const doc of documents) {
      const cat = doc.category || 'Uncategorized'
      categories[cat] = (categories[cat] || 0) + 1
    }

    res.json({
      documents,
      total,
      categories,
      pagination: getPaginationMeta(total, pagination.page, pagination.limit),
    })
}))

// POST /api/documents/upload - Upload a document
router.post('/upload', upload.single('file'), asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id
    if (!userId) {
      throw AppError.unauthorized()
    }

    if (!req.file) {
      throw AppError.badRequest('No file uploaded')
    }

    const { projectId, lotId, documentType, category, caption, tags } = req.body

    if (!projectId || !documentType) {
      // Clean up uploaded file if using disk storage
      if (req.file.path) {
        fs.unlinkSync(req.file.path)
      }
      throw AppError.badRequest('projectId and documentType are required')
    }

    const hasAccess = await checkProjectAccess(userId, projectId)
    if (!hasAccess) {
      if (req.file.path) {
        fs.unlinkSync(req.file.path)
      }
      throw AppError.forbidden('Access denied')
    }

    let fileUrl: string
    let photoMetadata: Awaited<ReturnType<typeof extractPhotoMetadata>> = {}

    // Upload to Supabase Storage if configured, otherwise use local filesystem
    if (isSupabaseConfigured() && req.file.buffer) {
      // For EXIF extraction from memory buffer, write to temp file
      if (req.file.mimetype.startsWith('image/')) {
        const tempPath = path.join(uploadDir, `temp-${Date.now()}-${req.file.originalname}`)
        fs.writeFileSync(tempPath, req.file.buffer)
        photoMetadata = await extractPhotoMetadata(tempPath, req.file.mimetype)
        fs.unlinkSync(tempPath) // Clean up temp file
      }

      // Upload to Supabase
      const { url } = await uploadToSupabase(req.file, projectId)
      fileUrl = url
    } else {
      // Fallback to local filesystem
      photoMetadata = await extractPhotoMetadata(req.file.path, req.file.mimetype)
      fileUrl = `/uploads/documents/${req.file.filename}`
    }

    // Create document record
    const document = await prisma.document.create({
      data: {
        projectId,
        lotId: lotId || null,
        documentType,
        category: category || null,
        filename: req.file.originalname,
        fileUrl,
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
}))

// Feature #481: POST /api/documents/:documentId/version - Upload a new version of a document
router.post('/:documentId/version', upload.single('file'), asyncHandler(async (req: Request, res: Response) => {
    const { documentId } = req.params
    const userId = req.user!.id
    if (!userId) {
      throw AppError.unauthorized()
    }

    if (!req.file) {
      throw AppError.badRequest('No file uploaded')
    }

    // Find the original document
    const originalDocument = await prisma.document.findUnique({
      where: { id: documentId },
    })

    if (!originalDocument) {
      if (req.file.path) fs.unlinkSync(req.file.path)
      throw AppError.notFound('Original document')
    }

    const hasAccess = await checkProjectAccess(userId, originalDocument.projectId)
    if (!hasAccess) {
      if (req.file.path) fs.unlinkSync(req.file.path)
      throw AppError.forbidden('Access denied')
    }

    // Find the root document (first version)
    let rootDocumentId = originalDocument.id
    // Note: currentVersion is tracked via allVersions query below
    if (originalDocument.parentDocumentId) {
      // This is already a version, find the root
      const rootDocument = await prisma.document.findUnique({
        where: { id: originalDocument.parentDocumentId },
      })
      if (rootDocument) {
        rootDocumentId = rootDocument.id
      }
    }

    // Get highest version number for this document chain
    const allVersions = await prisma.document.findMany({
      where: {
        OR: [
          { id: rootDocumentId },
          { parentDocumentId: rootDocumentId }
        ]
      },
      select: { version: true }
    })
    const highestVersion = Math.max(...allVersions.map(v => v.version))
    const newVersion = highestVersion + 1

    let fileUrl: string
    let photoMetadata: Awaited<ReturnType<typeof extractPhotoMetadata>> = {}

    // Upload to Supabase Storage if configured, otherwise use local filesystem
    if (isSupabaseConfigured() && req.file.buffer) {
      // For EXIF extraction from memory buffer, write to temp file
      if (req.file.mimetype.startsWith('image/')) {
        const tempPath = path.join(uploadDir, `temp-${Date.now()}-${req.file.originalname}`)
        fs.writeFileSync(tempPath, req.file.buffer)
        photoMetadata = await extractPhotoMetadata(tempPath, req.file.mimetype)
        fs.unlinkSync(tempPath)
      }

      const { url } = await uploadToSupabase(req.file, originalDocument.projectId)
      fileUrl = url
    } else {
      photoMetadata = await extractPhotoMetadata(req.file.path, req.file.mimetype)
      fileUrl = `/uploads/documents/${req.file.filename}`
    }

    // Mark all previous versions as not latest
    await prisma.document.updateMany({
      where: {
        OR: [
          { id: rootDocumentId },
          { parentDocumentId: rootDocumentId }
        ]
      },
      data: { isLatestVersion: false }
    })

    // Create new version
    const newDocument = await prisma.document.create({
      data: {
        projectId: originalDocument.projectId,
        lotId: originalDocument.lotId,
        documentType: originalDocument.documentType,
        category: originalDocument.category,
        filename: req.file.originalname,
        fileUrl,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedById: userId,
        caption: originalDocument.caption,
        tags: originalDocument.tags,
        version: newVersion,
        parentDocumentId: rootDocumentId,
        isLatestVersion: true,
        gpsLatitude: photoMetadata.gpsLatitude,
        gpsLongitude: photoMetadata.gpsLongitude,
        captureTimestamp: photoMetadata.captureTimestamp,
        aiClassification: photoMetadata.deviceInfo ? JSON.stringify({ deviceInfo: photoMetadata.deviceInfo }) : null,
      },
      include: {
        lot: { select: { id: true, lotNumber: true } },
        uploadedBy: { select: { id: true, fullName: true, email: true } },
      },
    })

    res.status(201).json(newDocument)
}))

// Feature #481: GET /api/documents/:documentId/versions - Get all versions of a document
router.get('/:documentId/versions', asyncHandler(async (req: Request, res: Response) => {
    const { documentId } = req.params
    const userId = req.user!.id

    if (!userId) {
      throw AppError.unauthorized()
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      throw AppError.notFound('Document')
    }

    const hasAccess = await checkProjectAccess(userId, document.projectId)
    if (!hasAccess) {
      throw AppError.forbidden('Access denied')
    }

    // Find the root document ID
    let rootDocumentId = document.parentDocumentId || document.id

    // Get all versions
    const versions = await prisma.document.findMany({
      where: {
        OR: [
          { id: rootDocumentId },
          { parentDocumentId: rootDocumentId }
        ]
      },
      include: {
        uploadedBy: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { version: 'desc' }
    })

    res.json({
      documentId: rootDocumentId,
      totalVersions: versions.length,
      versions,
    })
}))

// GET /api/documents/file/:documentId - Get document file (requires auth)
router.get('/file/:documentId', asyncHandler(async (req: Request, res: Response) => {
    const { documentId } = req.params
    const userId = req.user!.id

    if (!userId) {
      throw AppError.unauthorized()
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      throw AppError.notFound('Document')
    }

    const hasAccess = await checkProjectAccess(userId, document.projectId)
    if (!hasAccess) {
      throw AppError.forbidden('Access denied')
    }

    const filePath = path.join(process.cwd(), document.fileUrl)
    if (!fs.existsSync(filePath)) {
      throw AppError.notFound('File')
    }

    res.sendFile(filePath)
}))

// Feature #741: POST /api/documents/:documentId/signed-url - Generate a signed URL for file download
// This creates a time-limited, secure URL that can be shared without requiring auth
router.post('/:documentId/signed-url', asyncHandler(async (req: Request, res: Response) => {
    const { documentId } = req.params
    const { expiresInMinutes = 15 } = req.body
    const userId = req.user!.id

    if (!userId) {
      throw AppError.unauthorized()
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      throw AppError.notFound('Document')
    }

    const hasAccess = await checkProjectAccess(userId, document.projectId)
    if (!hasAccess) {
      throw AppError.forbidden('Access denied')
    }

    // Validate expiry time (1 minute to 24 hours)
    const validExpiry = Math.max(1, Math.min(1440, parseInt(String(expiresInMinutes)) || 15))

    // Generate signed token
    const token = generateSignedUrlToken(documentId, userId, validExpiry)
    const expiresAt = new Date(Date.now() + validExpiry * 60 * 1000)

    // Construct the signed URL
    const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 4007}`
    const signedUrl = `${baseUrl}/api/documents/download/${documentId}?token=${token}`

    res.json({
      signedUrl,
      token,
      documentId,
      filename: document.filename,
      mimeType: document.mimeType,
      expiresAt: expiresAt.toISOString(),
      expiresInMinutes: validExpiry,
      message: `Signed URL valid for ${validExpiry} minutes`
    })
}))

// DELETE /api/documents/:documentId - Delete a document
router.delete('/:documentId', asyncHandler(async (req: Request, res: Response) => {
    const { documentId } = req.params
    const userId = req.user!.id

    if (!userId) {
      throw AppError.unauthorized()
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      throw AppError.notFound('Document')
    }

    const hasAccess = await checkProjectAccess(userId, document.projectId)
    if (!hasAccess) {
      throw AppError.forbidden('Access denied')
    }

    // Delete file from storage
    if (document.fileUrl.includes('supabase.co/storage')) {
      // Delete from Supabase Storage
      await deleteFromSupabase(document.fileUrl)
    } else {
      // Delete from local disk
      const filePath = path.join(process.cwd(), document.fileUrl)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    }

    // Audit log for document deletion
    await createAuditLog({
      projectId: document.projectId,
      userId,
      entityType: 'document',
      entityId: documentId,
      action: AuditAction.DOCUMENT_DELETED,
      changes: { filename: document.filename, fileUrl: document.fileUrl },
      req
    })

    // Delete database record
    await prisma.document.delete({ where: { id: documentId } })

    res.status(204).send()
}))

// Feature #247: AI Photo Classification
// POST /api/documents/:documentId/classify - Classify a photo using AI
router.post('/:documentId/classify', asyncHandler(async (req: Request, res: Response) => {
    const { documentId } = req.params
    const userId = req.user!.id

    if (!userId) {
      throw AppError.unauthorized()
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      throw AppError.notFound('Document')
    }

    const hasAccess = await checkProjectAccess(userId, document.projectId)
    if (!hasAccess) {
      throw AppError.forbidden('Access denied')
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
      throw AppError.badRequest('Only image files can be classified')
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

    // Feature #729: Multi-label classification support
    let suggestedClassifications: Array<{ label: string; confidence: number }> = []

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
            throw AppError.badRequest('Invalid base64 data URL format')
          }
          base64Image = base64Match[1]
        } else {
          // Read from file path
          const filePath = path.join(process.cwd(), document.fileUrl)
          if (!fs.existsSync(filePath)) {
            throw AppError.notFound('Image file')
          }
          const imageData = fs.readFileSync(filePath)
          base64Image = imageData.toString('base64')
        }

        // Call Anthropic API for multi-label image classification
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicApiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 200,
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
                    text: `Classify this civil construction photo. A photo may show multiple things happening.

Available categories: ${CLASSIFICATION_CATEGORIES.join(', ')}

List ALL applicable categories with confidence percentages (0-100), up to 3 categories.
Format each on a new line: CategoryName|Confidence

Example response for a photo showing excavation with safety equipment:
Excavation|90
Safety|75
Plant/Equipment|60

Respond with ONLY the category lines, nothing else.`
                  }
                ]
              }
            ]
          })
        })

        if (response.ok) {
          const result = await response.json() as { content: { type: string; text: string }[] }
          const aiResponse = result.content[0]?.text?.trim() || ''
          const lines = aiResponse.split('\n').filter(line => line.trim())

          for (const line of lines) {
            const [category, confidenceStr] = line.split('|')
            const matchedCategory = CLASSIFICATION_CATEGORIES.find(
              c => c.toLowerCase() === category?.toLowerCase().trim()
            )

            if (matchedCategory) {
              suggestedClassifications.push({
                label: matchedCategory,
                confidence: parseInt(confidenceStr) || 70
              })
            }
          }

          // Ensure at least one classification
          if (suggestedClassifications.length === 0) {
            suggestedClassifications = [{ label: 'General Progress', confidence: 50 }]
          }
        } else {
          throw new Error('Anthropic API request failed')
        }
      } catch (aiError) {
        // Fall back to simulated multi-label classification
        suggestedClassifications = simulateMultiLabelClassification(document.filename, document.caption)
      }
    } else {
      // Use simulated multi-label classification when no API key
      suggestedClassifications = simulateMultiLabelClassification(document.filename, document.caption)
    }

    // Sort by confidence and limit to top 3
    suggestedClassifications.sort((a, b) => b.confidence - a.confidence)
    suggestedClassifications = suggestedClassifications.slice(0, 3)

    // Primary classification is the highest confidence one (for backward compatibility)
    const primaryClassification = suggestedClassifications[0] || { label: 'General Progress', confidence: 50 }

    res.json({
      documentId,
      // Backward compatible single classification
      suggestedClassification: primaryClassification.label,
      confidence: primaryClassification.confidence,
      // Feature #729: Multi-label classifications
      suggestedClassifications,
      isMultiLabel: suggestedClassifications.length > 1,
      categories: CLASSIFICATION_CATEGORIES
    })
}))

// Feature #729: Multi-label classification based on keywords
function simulateMultiLabelClassification(
  filename: string,
  caption: string | null
): Array<{ label: string; confidence: number }> {
  const text = `${filename} ${caption || ''}`.toLowerCase()
  const matches: Array<{ label: string; confidence: number }> = []

  // Keyword-based classification with confidence scores
  const classificationRules: Array<{ label: string; keywords: string[]; baseConfidence: number }> = [
    { label: 'Survey', keywords: ['survey', 'level', 'gps', 'theodolite', 'setout', 'peg'], baseConfidence: 85 },
    { label: 'Compaction', keywords: ['compact', 'roller', 'density', 'proctor', 'ndd'], baseConfidence: 85 },
    { label: 'Material Delivery', keywords: ['delivery', 'truck', 'material', 'stockpile', 'load'], baseConfidence: 80 },
    { label: 'Excavation', keywords: ['excavat', 'dig', 'trench', 'dozer', 'cut'], baseConfidence: 85 },
    { label: 'Formwork', keywords: ['form', 'boxing', 'rebar', 'reinforce', 'steel'], baseConfidence: 85 },
    { label: 'Concrete Pour', keywords: ['concrete', 'pour', 'slump', 'agitator', 'pump'], baseConfidence: 90 },
    { label: 'Pipe Laying', keywords: ['pipe', 'culvert', 'drain', 'stormwater', 'sewer'], baseConfidence: 85 },
    { label: 'Inspection', keywords: ['inspect', 'check', 'review', 'witness', 'audit'], baseConfidence: 75 },
    { label: 'Testing', keywords: ['test', 'sample', 'lab', 'specimen'], baseConfidence: 80 },
    { label: 'Safety', keywords: ['safety', 'ppe', 'hazard', 'sign', 'barrier', 'swms'], baseConfidence: 80 },
    { label: 'Plant/Equipment', keywords: ['plant', 'machine', 'equipment', 'excavator', 'grader', 'crane'], baseConfidence: 75 },
    { label: 'General Progress', keywords: ['progress', 'site', 'work', 'general'], baseConfidence: 60 },
  ]

  for (const rule of classificationRules) {
    let matchCount = 0
    for (const keyword of rule.keywords) {
      if (text.includes(keyword)) {
        matchCount++
      }
    }

    if (matchCount > 0) {
      // Confidence increases with more keyword matches
      const confidenceBoost = Math.min((matchCount - 1) * 5, 10)
      matches.push({
        label: rule.label,
        confidence: Math.min(rule.baseConfidence + confidenceBoost, 95)
      })
    }
  }

  // Sort by confidence descending
  matches.sort((a, b) => b.confidence - a.confidence)

  // If no matches, default to General Progress
  if (matches.length === 0) {
    matches.push({ label: 'General Progress', confidence: 50 })
  }

  // Return top 3 matches
  return matches.slice(0, 3)
}

// POST /api/documents/:documentId/save-classification - Save the classification
// Feature #729: Supports both single classification and multi-label classifications
router.post('/:documentId/save-classification', asyncHandler(async (req: Request, res: Response) => {
    const { documentId } = req.params
    const { classification, classifications } = req.body
    const userId = req.user!.id

    if (!userId) {
      throw AppError.unauthorized()
    }

    // Support both single classification (backward compat) and multi-label
    const finalClassification = classification || (classifications && classifications.length > 0
      ? classifications.map((c: { label: string }) => c.label).join(', ')
      : null)

    if (!finalClassification) {
      throw AppError.badRequest('Classification is required')
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      throw AppError.notFound('Document')
    }

    const hasAccess = await checkProjectAccess(userId, document.projectId)
    if (!hasAccess) {
      throw AppError.forbidden('Access denied')
    }

    // Update the document with the classification
    // If multiple classifications provided, store as comma-separated for display
    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: {
        aiClassification: finalClassification
      },
      include: {
        lot: { select: { id: true, lotNumber: true } },
        uploadedBy: { select: { id: true, fullName: true, email: true } },
      },
    })

    res.json({
      ...updatedDocument,
      // Feature #729: Return parsed classifications array for convenience
      classificationLabels: finalClassification.split(', ').filter(Boolean)
    })
}))

// PATCH /api/documents/:documentId - Update document metadata
router.patch('/:documentId', asyncHandler(async (req: Request, res: Response) => {
    const { documentId } = req.params
    const { lotId, category, caption, tags, isFavourite } = req.body
    const userId = req.user!.id

    if (!userId) {
      throw AppError.unauthorized()
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      throw AppError.notFound('Document')
    }

    const hasAccess = await checkProjectAccess(userId, document.projectId)
    if (!hasAccess) {
      throw AppError.forbidden('Access denied')
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
}))

export default router

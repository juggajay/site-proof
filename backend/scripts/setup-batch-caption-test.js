// Script to create test data for photo batch captioning feature
// Creates: project, lot, ITP template, ITP instance, and multiple photos

import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

async function main() {
  console.log('Setting up batch caption test data...')

  // Get admin user
  const adminUser = await prisma.user.findFirst({
    where: { email: 'admin@test.com' }
  })

  if (!adminUser) {
    console.error('Admin user not found. Run with existing admin@test.com user.')
    return
  }

  console.log('Found admin user:', adminUser.email)

  // Get or create project
  let project = await prisma.project.findFirst({
    where: { projectNumber: 'BATCH-CAPTION-TEST' }
  })

  if (!project) {
    project = await prisma.project.create({
      data: {
        name: 'Batch Caption Test Project',
        projectNumber: 'BATCH-CAPTION-TEST',
        status: 'active',
        state: 'NSW',
        specificationSet: 'RMS',
        companyId: adminUser.companyId,
        contractValue: 1000000,
      }
    })
    console.log('Created project:', project.name)

    // Add admin as project member
    await prisma.projectUser.create({
      data: {
        projectId: project.id,
        userId: adminUser.id,
        role: 'admin'
      }
    })
  } else {
    console.log('Using existing project:', project.name)
  }

  // Get or create lot
  let lot = await prisma.lot.findFirst({
    where: {
      lotNumber: 'BATCH-LOT-001',
      projectId: project.id
    }
  })

  if (!lot) {
    lot = await prisma.lot.create({
      data: {
        lotNumber: 'BATCH-LOT-001',
        description: 'Test lot for batch captioning',
        projectId: project.id,
        status: 'in_progress',
        lotType: 'standard',
        activityType: 'Earthworks'
      }
    })
    console.log('Created lot:', lot.lotNumber)
  } else {
    console.log('Using existing lot:', lot.lotNumber)
  }

  // Get or create ITP template
  let template = await prisma.iTPTemplate.findFirst({
    where: {
      name: 'Batch Caption Test Template',
      projectId: project.id
    },
    include: { checklistItems: true }
  })

  if (!template) {
    template = await prisma.iTPTemplate.create({
      data: {
        name: 'Batch Caption Test Template',
        description: 'Template for testing batch photo captioning',
        project: { connect: { id: project.id } },
        activityType: 'Earthworks',
      },
    })
    console.log('Created ITP template:', template.name)

    // Create checklist items separately
    await prisma.iTPChecklistItem.createMany({
      data: [
        {
          templateId: template.id,
          description: 'Site preparation inspection',
          responsibleParty: 'contractor',
          pointType: 'standard',
          evidenceRequired: 'photo',
          sequenceNumber: 1
        },
        {
          templateId: template.id,
          description: 'Material delivery verification',
          responsibleParty: 'contractor',
          pointType: 'standard',
          evidenceRequired: 'photo',
          sequenceNumber: 2
        },
        {
          templateId: template.id,
          description: 'Work completion inspection',
          responsibleParty: 'contractor',
          pointType: 'standard',
          evidenceRequired: 'photo',
          sequenceNumber: 3
        }
      ]
    })

    // Re-fetch template with checklist items
    template = await prisma.iTPTemplate.findUnique({
      where: { id: template.id },
      include: { checklistItems: true }
    })
  } else {
    console.log('Using existing ITP template:', template.name)
    // Make sure we have the checklist items
    if (!template.checklistItems || template.checklistItems.length === 0) {
      // Create checklist items if missing
      await prisma.iTPChecklistItem.createMany({
        data: [
          {
            templateId: template.id,
            description: 'Site preparation inspection',
            responsibleParty: 'contractor',
            pointType: 'standard',
            evidenceRequired: 'photo',
            sequenceNumber: 1
          },
          {
            templateId: template.id,
            description: 'Material delivery verification',
            responsibleParty: 'contractor',
            pointType: 'standard',
            evidenceRequired: 'photo',
            sequenceNumber: 2
          },
          {
            templateId: template.id,
            description: 'Work completion inspection',
            responsibleParty: 'contractor',
            pointType: 'standard',
            evidenceRequired: 'photo',
            sequenceNumber: 3
          }
        ]
      })
      // Re-fetch template with checklist items
      template = await prisma.iTPTemplate.findUnique({
        where: { id: template.id },
        include: { checklistItems: true }
      })
      console.log('Added missing checklist items to template')
    }
  }

  // Get or create ITP instance for the lot
  let itpInstance = await prisma.iTPInstance.findFirst({
    where: {
      lotId: lot.id,
      templateId: template.id
    }
  })

  if (!itpInstance) {
    itpInstance = await prisma.iTPInstance.create({
      data: {
        lotId: lot.id,
        templateId: template.id,
        status: 'in_progress'
      }
    })
    console.log('Created ITP instance for lot')
  } else {
    console.log('Using existing ITP instance')
  }

  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), 'uploads', 'documents')
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
  }

  // Create test images
  const photoNames = [
    'Site prep photo 1',
    'Site prep photo 2',
    'Material delivery photo',
    'Work completion photo'
  ]

  // Create a simple PNG file (1x1 pixel for testing)
  const pngBuffer = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, // IHDR chunk length
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x64, // width 100
    0x00, 0x00, 0x00, 0x64, // height 100
    0x08, 0x02, // bit depth 8, color type 2 (RGB)
    0x00, 0x00, 0x00, // compression, filter, interlace
    0x58, 0x43, 0x10, 0x09, // CRC
    0x00, 0x00, 0x00, 0x00, // IDAT chunk (empty for simplicity)
    0x49, 0x44, 0x41, 0x54,
    0x08, 0xD7, 0x63, 0x60, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01,
    0xE2, 0x21, 0xBC, 0x33, // CRC
    0x00, 0x00, 0x00, 0x00, // IEND chunk
    0x49, 0x45, 0x4E, 0x44,
    0xAE, 0x42, 0x60, 0x82
  ])

  for (let i = 0; i < photoNames.length; i++) {
    const filename = `batch-test-photo-${i + 1}.png`
    const filepath = path.join(uploadsDir, filename)

    if (!fs.existsSync(filepath)) {
      fs.writeFileSync(filepath, pngBuffer)
      console.log('Created test image:', filename)
    }

    // Create document record
    let document = await prisma.document.findFirst({
      where: {
        filename: filename,
        projectId: project.id
      }
    })

    if (!document) {
      document = await prisma.document.create({
        data: {
          filename: filename,
          fileUrl: `/uploads/documents/${filename}`,
          fileSize: pngBuffer.length,
          mimeType: 'image/png',
          projectId: project.id,
          lotId: lot.id,
          documentType: 'photo',
          uploadedById: adminUser.id,
          caption: null // No caption initially
        }
      })
      console.log('Created document record:', document.filename)
    } else {
      // Clear caption if exists to reset for testing
      document = await prisma.document.update({
        where: { id: document.id },
        data: { caption: null }
      })
      console.log('Reset caption for document:', document.filename)
    }

    // Get checklist item (cycle through the 3 items)
    const checklistItemIndex = i % template.checklistItems.length
    const checklistItem = template.checklistItems[checklistItemIndex]

    // Get or create ITP completion for this checklist item
    let completion = await prisma.iTPCompletion.findFirst({
      where: {
        itpInstanceId: itpInstance.id,
        checklistItemId: checklistItem.id
      }
    })

    if (!completion) {
      completion = await prisma.iTPCompletion.create({
        data: {
          itpInstanceId: itpInstance.id,
          checklistItemId: checklistItem.id,
          completedById: adminUser.id,
          completedAt: new Date(),
          status: 'completed',
          notes: 'Test completion'
        }
      })
      console.log('Created ITP completion for item:', checklistItem.description)
    }

    // Create ITP attachment linking document to completion
    const existingAttachment = await prisma.iTPCompletionAttachment.findFirst({
      where: {
        completionId: completion.id,
        documentId: document.id
      }
    })

    if (!existingAttachment) {
      await prisma.iTPCompletionAttachment.create({
        data: {
          completionId: completion.id,
          documentId: document.id
        }
      })
      console.log('Created ITP attachment for:', document.filename)
    }
  }

  console.log('\n=== Test data setup complete ===')
  console.log('Project ID:', project.id)
  console.log('Lot ID:', lot.id)
  console.log('ITP Instance ID:', itpInstance.id)
  console.log('\nTo test:')
  console.log(`1. Navigate to: http://localhost:5174/projects/${project.id}/lots`)
  console.log(`2. Click on lot ${lot.lotNumber}`)
  console.log('3. Go to Photos tab')
  console.log('4. Select photos and click Bulk Caption')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

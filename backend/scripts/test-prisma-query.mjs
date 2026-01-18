import dotenv from 'dotenv'
dotenv.config({ path: 'D:/site-proofv3/backend/.env' })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    // First, get the ITP instance and its checklist items
    const instance = await prisma.iTPInstance.findUnique({
      where: { id: 'f1ccc551-b396-413b-a344-4a4c2c2bd64f' },
      include: {
        template: {
          include: {
            checklistItems: true
          }
        }
      }
    })

    if (!instance) {
      console.log('ITP instance not found')
      return
    }

    console.log('ITP Instance found')
    console.log('Template:', instance.template?.name)
    console.log('Template ID:', instance.templateId)
    console.log('Checklist items:', instance.template?.checklistItems.length)

    // Show first few items
    console.log('\nFirst 3 checklist items:')
    instance.template?.checklistItems.slice(0, 3).forEach(item => {
      console.log(`  - ${item.id}: ${item.description}`)
    })

    // Get a valid checklist item ID (Item 6)
    const item6 = instance.template?.checklistItems.find(i => i.sequenceNumber === 6)
    if (!item6) {
      console.log('Item 6 not found')
      return
    }
    console.log('\nUsing Item 6:', item6.id, item6.description)

    // Get admin user ID
    const admin = await prisma.user.findFirst({
      where: { email: 'admin@test.com' }
    })
    console.log('Admin user:', admin?.id, admin?.email)

    // Test a simple query similar to what the completion endpoint does
    const existingCompletion = await prisma.iTPCompletion.findFirst({
      where: {
        itpInstanceId: 'f1ccc551-b396-413b-a344-4a4c2c2bd64f',
        checklistItemId: item6.id
      }
    })

    console.log('Existing completion:', existingCompletion)

    // Try creating or updating a completion with the includes
    if (existingCompletion) {
      const updated = await prisma.iTPCompletion.update({
        where: { id: existingCompletion.id },
        data: {
          status: 'not_applicable',
          notes: 'Test N/A from Prisma script',
          completedAt: new Date(),
          completedById: admin?.id // admin user id
        },
        include: {
          completedBy: {
            select: { id: true, fullName: true, email: true }
          },
          verifiedBy: {
            select: { id: true, fullName: true, email: true }
          },
          attachments: true
        }
      })
      console.log('Updated completion:', JSON.stringify(updated, null, 2))
      console.log('Status:', updated.status)
    } else {
      console.log('No existing completion, creating one...')
      const created = await prisma.iTPCompletion.create({
        data: {
          itpInstanceId: 'f1ccc551-b396-413b-a344-4a4c2c2bd64f',
          checklistItemId: item6.id,
          status: 'not_applicable',
          notes: 'Test N/A created directly via Prisma',
          completedAt: new Date(),
          completedById: admin?.id
        },
        include: {
          completedBy: {
            select: { id: true, fullName: true, email: true }
          },
          verifiedBy: {
            select: { id: true, fullName: true, email: true }
          },
          attachments: true
        }
      })
      console.log('Created completion:', JSON.stringify(created, null, 2))
      console.log('Status:', created.status)
    }
  } catch (error) {
    console.error('Error:', error)
  }
}

main().finally(() => prisma.$disconnect())

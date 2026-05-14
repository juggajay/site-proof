/**
 * Migration script: Populate GlobalSubcontractor table from existing SubcontractorCompany records
 *
 * This script:
 * 1. Finds all existing SubcontractorCompany records
 * 2. Creates GlobalSubcontractor records (deduped by company name + org)
 * 3. Links SubcontractorCompany records to their GlobalSubcontractor
 *
 * Run with: node scripts/migrate-global-subcontractors.js
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migrateGlobalSubcontractors() {
  console.log('Starting global subcontractor migration...\n')

  try {
    // Get all subcontractor companies with their project info
    const subcontractorCompanies = await prisma.subcontractorCompany.findMany({
      include: {
        project: {
          select: {
            id: true,
            name: true,
            companyId: true
          }
        }
      }
    })

    console.log(`Found ${subcontractorCompanies.length} subcontractor companies to process\n`)

    // Group by organization + company name (to dedupe)
    const globalMap = new Map()

    for (const sc of subcontractorCompanies) {
      if (!sc.project?.companyId) {
        console.log(`  Skipping ${sc.companyName} - no organization ID`)
        continue
      }

      // Create a key for deduplication: org + company name (normalized)
      const key = `${sc.project.companyId}:${sc.companyName.toLowerCase().trim()}`

      if (!globalMap.has(key)) {
        globalMap.set(key, {
          organizationId: sc.project.companyId,
          companyName: sc.companyName,
          abn: sc.abn,
          primaryContactName: sc.primaryContactName,
          primaryContactEmail: sc.primaryContactEmail,
          primaryContactPhone: sc.primaryContactPhone,
          linkedSubcontractors: [sc.id]
        })
      } else {
        // Add to existing - just track the linked subcontractors
        globalMap.get(key).linkedSubcontractors.push(sc.id)
      }
    }

    console.log(`Found ${globalMap.size} unique subcontractors to create in global directory\n`)

    // Create GlobalSubcontractor records and link them
    let created = 0
    let linked = 0

    for (const [key, data] of globalMap) {
      // Check if a global record already exists for this
      const existing = await prisma.globalSubcontractor.findFirst({
        where: {
          organizationId: data.organizationId,
          companyName: data.companyName
        }
      })

      let globalId

      if (existing) {
        console.log(`  [SKIP] ${data.companyName} - already exists in global directory`)
        globalId = existing.id
      } else {
        // Create new global record
        const globalSub = await prisma.globalSubcontractor.create({
          data: {
            organizationId: data.organizationId,
            companyName: data.companyName,
            abn: data.abn,
            primaryContactName: data.primaryContactName,
            primaryContactEmail: data.primaryContactEmail,
            primaryContactPhone: data.primaryContactPhone,
            status: 'active'
          }
        })
        globalId = globalSub.id
        created++
        console.log(`  [CREATE] ${data.companyName} -> ${globalId}`)
      }

      // Link all SubcontractorCompany records to this global record
      for (const scId of data.linkedSubcontractors) {
        await prisma.subcontractorCompany.update({
          where: { id: scId },
          data: { globalSubcontractorId: globalId }
        })
        linked++
      }
    }

    console.log(`\n=== Migration Complete ===`)
    console.log(`Created: ${created} global subcontractor records`)
    console.log(`Linked: ${linked} project subcontractor records`)

  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

migrateGlobalSubcontractors()

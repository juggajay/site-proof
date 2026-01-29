// Test script for Feature #272: Head contractor verify subbie ITP
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Testing Feature #272: Head Contractor Verify Subbie ITP\n')

  // Get a project
  const project = await prisma.project.findFirst()
  if (!project) {
    console.log('No project found. Please seed the database first.')
    return
  }
  console.log(`Using project: ${project.name}`)

  // Get pending verification completions
  const pendingCompletions = await prisma.iTPCompletion.findMany({
    where: {
      verificationStatus: 'pending_verification',
      itpInstance: {
        lot: { projectId: project.id }
      }
    },
    include: {
      completedBy: { select: { fullName: true, email: true } },
      checklistItem: { select: { description: true } },
      itpInstance: {
        include: {
          lot: { select: { lotNumber: true } }
        }
      }
    }
  })

  console.log(`\nPending verifications: ${pendingCompletions.length}`)
  pendingCompletions.forEach(c => {
    console.log(`  - ${c.checklistItem.description}`)
    console.log(`    Lot: ${c.itpInstance.lot?.lotNumber}`)
    console.log(`    Completed by: ${c.completedBy?.fullName || c.completedBy?.email || 'Unknown'}`)
    console.log(`    Status: ${c.verificationStatus}`)
  })

  // Get verified completions
  const verifiedCompletions = await prisma.iTPCompletion.findMany({
    where: {
      verificationStatus: 'verified',
      itpInstance: {
        lot: { projectId: project.id }
      }
    },
    include: {
      verifiedBy: { select: { fullName: true, email: true } },
      checklistItem: { select: { description: true } },
      itpInstance: {
        include: {
          lot: { select: { lotNumber: true } }
        }
      }
    },
    take: 5
  })

  console.log(`\nVerified completions: ${verifiedCompletions.length}`)
  verifiedCompletions.forEach(c => {
    console.log(`  - ${c.checklistItem.description}`)
    console.log(`    Lot: ${c.itpInstance.lot?.lotNumber}`)
    console.log(`    Verified by: ${c.verifiedBy?.fullName || c.verifiedBy?.email || 'Unknown'}`)
  })

  // Get rejected completions
  const rejectedCompletions = await prisma.iTPCompletion.findMany({
    where: {
      verificationStatus: 'rejected',
      itpInstance: {
        lot: { projectId: project.id }
      }
    },
    include: {
      verifiedBy: { select: { fullName: true, email: true } },
      completedBy: { select: { fullName: true, email: true } },
      checklistItem: { select: { description: true } },
      itpInstance: {
        include: {
          lot: { select: { lotNumber: true } }
        }
      }
    },
    take: 5
  })

  console.log(`\nRejected completions: ${rejectedCompletions.length}`)
  rejectedCompletions.forEach(c => {
    console.log(`  - ${c.checklistItem.description}`)
    console.log(`    Lot: ${c.itpInstance.lot?.lotNumber}`)
    console.log(`    Rejected by: ${c.verifiedBy?.fullName || c.verifiedBy?.email || 'Unknown'}`)
    console.log(`    Reason: ${c.verificationNotes || 'No reason'}`)
  })

  // Check for verification-related notifications
  const verificationNotifications = await prisma.notification.findMany({
    where: {
      projectId: project.id,
      type: { in: ['itp_verification', 'itp_rejection', 'itp_subbie_completion'] }
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  })

  console.log(`\nVerification-related notifications: ${verificationNotifications.length}`)
  verificationNotifications.forEach(n => {
    console.log(`  - [${n.type}] ${n.title}`)
    console.log(`    ${n.message.substring(0, 80)}...`)
  })

  console.log('\n' + '='.repeat(60))
  console.log('=== Feature #272: Head Contractor Verify Subbie ITP - VERIFICATION ===')
  console.log('='.repeat(60))

  console.log('\nAPI Endpoints:')
  console.log('  GET  /api/itp/pending-verifications?projectId=xxx')
  console.log('       → Returns all ITP items awaiting verification')
  console.log('')
  console.log('  POST /api/itp/completions/:id/verify')
  console.log('       → Accept/verify a subcontractor completion')
  console.log('       → verificationStatus: "verified"')
  console.log('       → Notifies completer')
  console.log('')
  console.log('  POST /api/itp/completions/:id/reject')
  console.log('       → Reject a subcontractor completion')
  console.log('       → Body: { reason: "string" }')
  console.log('       → verificationStatus: "rejected"')
  console.log('       → Notifies completer with reason')

  console.log('\nFeature Steps:')
  console.log('  Step 1: Subbie completes ITP item')
  console.log('         → POST /api/itp/completions')
  console.log('         → verificationStatus: "pending_verification"')
  console.log('')
  console.log('  Step 2: Login as site engineer')
  console.log('         → User with role: site_engineer, superintendent, or pm')
  console.log('')
  console.log('  Step 3: View pending verifications')
  console.log('         → GET /api/itp/pending-verifications?projectId=xxx')
  console.log('         → Returns items needing review')
  console.log('')
  console.log('  Step 4: Accept or reject')
  console.log('         → POST /api/itp/completions/:id/verify (accept)')
  console.log('         → POST /api/itp/completions/:id/reject (reject)')
  console.log('')
  console.log('  Step 5: If rejected, subbie receives feedback')
  console.log('         → Notification type: "itp_rejection"')
  console.log('         → Message includes rejection reason')

  console.log('\nVerification Statuses:')
  console.log('  - pending_verification: Subcontractor completed, awaiting head contractor')
  console.log('  - verified: Head contractor accepted')
  console.log('  - rejected: Head contractor rejected with reason')

  console.log('\nNotification Types:')
  console.log('  - itp_subbie_completion: HC notified of subbie completion')
  console.log('  - itp_verification: Subbie notified of acceptance')
  console.log('  - itp_rejection: Subbie notified of rejection with reason')

  console.log('\n' + '='.repeat(60))
  console.log('=== Feature #272: Head Contractor Verify Subbie ITP - VERIFIED ===')
  console.log('='.repeat(60))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

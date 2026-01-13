import { prisma } from './prisma.js'

interface ConformancePrerequisites {
  itpAssigned: boolean
  itpCompleted: boolean
  itpCompletedCount: number
  itpTotalCount: number
  itpIncompleteItems: { id: string; description: string; pointType: string }[]
  hasPassingTest: boolean
  testResults: { id: string; testType: string; passFail: string; status: string }[]
  noOpenNcrs: boolean
  openNcrs: { id: string; ncrNumber: string; description: string; status: string }[]
}

interface ConformanceCheckResult {
  error?: string
  lot: {
    id: string
    lotNumber: string
    status: string
    projectId: string
  } | null
  prerequisites?: ConformancePrerequisites
  canConform?: boolean
  blockingReasons?: string[]
}

export async function checkConformancePrerequisites(lotId: string): Promise<ConformanceCheckResult> {
  const lot = await prisma.lot.findUnique({
    where: { id: lotId },
    include: {
      itpInstance: {
        include: {
          template: {
            include: {
              checklistItems: true
            }
          },
          completions: true
        }
      },
      testResults: true,
      ncrLots: {
        include: {
          ncr: true
        }
      }
    }
  })

  if (!lot) {
    return { error: 'Lot not found', lot: null }
  }

  const prerequisites: ConformancePrerequisites = {
    itpAssigned: false,
    itpCompleted: false,
    itpCompletedCount: 0,
    itpTotalCount: 0,
    itpIncompleteItems: [],
    hasPassingTest: false,
    testResults: [],
    noOpenNcrs: true,
    openNcrs: []
  }

  // Check ITP completion
  if (lot.itpInstance) {
    prerequisites.itpAssigned = true
    const checklistItems = lot.itpInstance.template.checklistItems
    prerequisites.itpTotalCount = checklistItems.length

    // Check which items are completed
    const completedItemIds = lot.itpInstance.completions
      .filter(c => c.status === 'completed')
      .map(c => c.checklistItemId)

    prerequisites.itpCompletedCount = completedItemIds.length
    prerequisites.itpCompleted = completedItemIds.length === checklistItems.length && checklistItems.length > 0

    // Find incomplete items
    prerequisites.itpIncompleteItems = checklistItems
      .filter(item => !completedItemIds.includes(item.id))
      .map(item => ({
        id: item.id,
        description: item.description,
        pointType: item.pointType
      }))
  }

  // Check test results - need at least one passing and verified test
  prerequisites.testResults = lot.testResults.map(t => ({
    id: t.id,
    testType: t.testType,
    passFail: t.passFail,
    status: t.status
  }))

  // A lot needs at least one passing test that is verified
  prerequisites.hasPassingTest = lot.testResults.some(
    t => t.passFail === 'pass' && t.status === 'verified'
  )

  // Check for open NCRs (any NCR that isn't closed)
  // NCRs are linked to lots through the ncrLots join table
  const ncrs = lot.ncrLots.map(ncrLot => ncrLot.ncr)
  const openNcrs = ncrs.filter(ncr =>
    ncr.status !== 'closed' && ncr.status !== 'closed_concession'
  )
  prerequisites.openNcrs = openNcrs.map(ncr => ({
    id: ncr.id,
    ncrNumber: ncr.ncrNumber,
    description: ncr.description,
    status: ncr.status
  }))
  prerequisites.noOpenNcrs = openNcrs.length === 0

  // Determine if lot can be conformed
  const canConform =
    prerequisites.itpAssigned &&
    prerequisites.itpCompleted &&
    prerequisites.hasPassingTest &&
    prerequisites.noOpenNcrs

  const blockingReasons: string[] = []
  if (!prerequisites.itpAssigned) {
    blockingReasons.push('No ITP assigned to this lot')
  }
  if (!prerequisites.itpCompleted && prerequisites.itpAssigned) {
    blockingReasons.push(`ITP checklist incomplete (${prerequisites.itpCompletedCount}/${prerequisites.itpTotalCount} items completed)`)
  }
  if (!prerequisites.hasPassingTest) {
    blockingReasons.push('No passing verified test result')
  }
  if (!prerequisites.noOpenNcrs) {
    blockingReasons.push(`${prerequisites.openNcrs.length} open NCR(s) must be closed`)
  }

  return {
    lot: {
      id: lot.id,
      lotNumber: lot.lotNumber,
      status: lot.status,
      projectId: lot.projectId
    },
    prerequisites,
    canConform,
    blockingReasons
  }
}

/**
 * Check lots with area zones using Prisma
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const lots = await prisma.lot.findMany({
    where: {
      lotNumber: {
        startsWith: 'AREA-FILTER'
      }
    },
    select: {
      lotNumber: true,
      areaZone: true,
      description: true
    }
  })

  console.log('Lots with AREA-FILTER prefix:')
  lots.forEach(lot => {
    console.log(`  ${lot.lotNumber}: areaZone="${lot.areaZone || 'NULL'}"`)
  })

  // Also check all lots with non-null areaZone
  const lotsWithArea = await prisma.lot.findMany({
    where: {
      areaZone: { not: null }
    },
    select: {
      lotNumber: true,
      areaZone: true
    },
    take: 10
  })

  console.log('\nLots with non-null areaZone:')
  lotsWithArea.forEach(lot => {
    console.log(`  ${lot.lotNumber}: "${lot.areaZone}"`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

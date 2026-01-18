import dotenv from 'dotenv'
dotenv.config({ path: 'D:/site-proofv3/backend/.env' })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const completions = await prisma.iTPCompletion.findMany({
    where: {
      itpInstance: {
        lotId: 'd1499c3e-b18c-44b9-9986-04e679513471'
      }
    },
    select: {
      id: true,
      checklistItemId: true,
      status: true,
      notes: true
    }
  })

  console.log('Completions for NA-TEST-LOT-001:')
  console.log(JSON.stringify(completions, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

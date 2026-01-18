import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    where: {
      email: { contains: 'commercial' }
    },
    select: { 
      email: true, 
      fullName: true,
      emailVerified: true,
      roleInCompany: true
    }
  })
  
  console.log('Commercial users:', users)
}

main().catch(console.error).finally(() => prisma.$disconnect())

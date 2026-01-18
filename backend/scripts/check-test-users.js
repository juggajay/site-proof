import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    where: {
      email: { contains: 'test' }
    },
    select: { 
      email: true, 
      fullName: true,
      emailVerified: true
    },
    take: 10
  })
  
  console.log('Test users:', users)
}

main().catch(console.error).finally(() => prisma.$disconnect())

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'test-verify-950@example.com' },
    select: { 
      email: true, 
      fullName: true,
      emailVerified: true, 
      emailVerifiedAt: true 
    }
  })
  
  console.log('User:', user)
}

main().catch(console.error).finally(() => prisma.$disconnect())

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const token = await prisma.emailVerificationToken.findFirst({
    where: {
      user: {
        email: 'test-verify-950@example.com'
      },
      usedAt: null,
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: 'desc' }
  })
  
  if (token) {
    console.log('TOKEN:', token.token)
    console.log('Expires:', token.expiresAt)
  } else {
    console.log('No valid token found')
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())

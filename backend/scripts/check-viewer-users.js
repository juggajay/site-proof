import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    where: { email: { contains: 'viewer' } },
    select: {
      email: true,
      roleInCompany: true,
      emailVerified: true,
      passwordHash: true
    }
  })

  console.log('Viewer users:')
  users.forEach(u => {
    console.log(`  - ${u.email} | role: ${u.roleInCompany} | verified: ${u.emailVerified} | hasPassword: ${!!u.passwordHash}`)
  })
}

main().catch(console.error).finally(() => prisma.$disconnect())

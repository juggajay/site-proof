import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Re-add admin@test.com to their company
  await prisma.$executeRaw`UPDATE users SET company_id = '13bda67c-a5a0-4d84-9ddc-6025cc7a2647', role_in_company = 'admin' WHERE email = 'admin@test.com'`

  const user = await prisma.user.findFirst({
    where: { email: 'admin@test.com' },
    select: { id: true, email: true, companyId: true, roleInCompany: true }
  })

  console.log('Restored admin user company:', JSON.stringify(user, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())

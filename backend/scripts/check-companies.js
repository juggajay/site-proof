import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const companies = await prisma.company.findMany({ take: 5 })
  console.log('Companies:', JSON.stringify(companies, null, 2))

  const usersWithCompany = await prisma.user.findMany({
    where: { companyId: { not: null } },
    select: { id: true, email: true, companyId: true, roleInCompany: true },
    take: 5
  })
  console.log('Users with company:', JSON.stringify(usersWithCompany, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.projectUser.findMany({
    where: { projectId: '28490410-acc1-4d6d-8638-6bfb3f339d92' },
    include: {
      user: { select: { email: true, fullName: true, roleInCompany: true } }
    }
  })
  console.log('Project Users in Subcontractor Test Project:')
  console.log(JSON.stringify(users, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

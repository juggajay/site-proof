import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]
  const role = process.argv[3]

  if (!email || !role) {
    console.log('Usage: node update-role.js <email> <role>')
    process.exit(1)
  }

  const user = await prisma.user.update({
    where: { email },
    data: { roleInCompany: role }
  })

  console.log(`Updated user ${user.email} to role: ${user.roleInCompany}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

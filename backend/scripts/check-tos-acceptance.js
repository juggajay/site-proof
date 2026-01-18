import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Query using raw SQL to get ToS fields
  const users = await prisma.$queryRaw`
    SELECT id, email, tos_accepted_at, tos_version
    FROM users
    WHERE tos_accepted_at IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 10
  `

  console.log('Users with ToS acceptance:')
  console.log(JSON.stringify(users, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

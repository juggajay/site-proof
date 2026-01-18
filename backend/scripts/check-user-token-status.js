/**
 * Check user's token invalidation status
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const user = await prisma.$queryRaw`SELECT id, email, token_invalidated_at FROM users WHERE email = 'admin@test.com'`
  console.log('User:', JSON.stringify(user, null, 2))

  // Check the iat of a token issued now
  const now = Date.now()
  console.log('\nCurrent time (ms):', now)
  console.log('Current time (ISO):', new Date(now).toISOString())

  if (user[0]?.token_invalidated_at) {
    const invalidatedAt = new Date(user[0].token_invalidated_at)
    console.log('\nToken invalidated at:', invalidatedAt.toISOString())
    console.log('Token invalidated at (ms):', invalidatedAt.getTime())
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

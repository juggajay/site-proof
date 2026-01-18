import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex')
}

async function main() {
  // Update site-engineer@test.com's password
  const user = await prisma.user.update({
    where: { email: 'site-engineer@test.com' },
    data: {
      passwordHash: hashPassword('password123'),
    },
  })
  console.log('Updated passwordHash for:', user.email)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

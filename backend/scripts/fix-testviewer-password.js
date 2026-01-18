import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex')
}

async function main() {
  // Update testviewer@test.com's password and verify email
  const user = await prisma.user.update({
    where: { email: 'testviewer@test.com' },
    data: {
      passwordHash: hashPassword('password123'),
      emailVerified: true,
      emailVerifiedAt: new Date()
    },
  })
  console.log('Updated password for:', user.email)
  console.log('Role:', user.roleInCompany)
  console.log('Verified:', user.emailVerified)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

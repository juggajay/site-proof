import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

// Simple password hashing (matching the auth.ts implementation)
function hashPassword(password) {
  const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex')
}

async function main() {
  const companyId = '13bda67c-a5a0-4d84-9ddc-6025cc7a2647' // Test Admin's Company

  // Set admin@test.com as owner for testing
  await prisma.$executeRaw`UPDATE users SET role_in_company = 'owner' WHERE email = 'admin@test.com'`

  // Create a second user in the same company for transfer target
  const targetEmail = 'transfer-target@test.com'
  const existing = await prisma.user.findFirst({ where: { email: targetEmail } })

  if (!existing) {
    await prisma.user.create({
      data: {
        email: targetEmail,
        passwordHash: hashPassword('password123'),
        fullName: 'Transfer Target User',
        roleInCompany: 'admin',
        companyId: companyId,
        emailVerified: true,
      }
    })
    console.log('Created transfer target user:', targetEmail)
  } else {
    // Make sure they're in the same company
    await prisma.$executeRaw`UPDATE users SET company_id = ${companyId}, role_in_company = 'admin' WHERE email = ${targetEmail}`
    console.log('Updated transfer target user:', targetEmail)
  }

  // Verify setup
  const users = await prisma.user.findMany({
    where: { companyId },
    select: { email: true, roleInCompany: true, fullName: true }
  })

  console.log('\nUsers in Test Admin\'s Company:')
  users.forEach(u => console.log(`  - ${u.email} (${u.roleInCompany}) - ${u.fullName || 'No name'}`))
}

main().catch(console.error).finally(() => prisma.$disconnect())

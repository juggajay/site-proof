import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

// Hash password function (same as in auth.ts)
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex')
}

async function main() {
  // Create owner user
  const owner = await prisma.user.upsert({
    where: { email: 'owner@test.com' },
    update: {
      roleInCompany: 'owner',
    },
    create: {
      email: 'owner@test.com',
      passwordHash: hashPassword('password123'),
      fullName: 'Test Owner',
      roleInCompany: 'owner',
    },
  })
  console.log('Created/Updated owner:', owner.email, '- Role:', owner.roleInCompany)

  // Create site_engineer user
  const siteEngineer = await prisma.user.upsert({
    where: { email: 'engineer@test.com' },
    update: {
      roleInCompany: 'site_engineer',
    },
    create: {
      email: 'engineer@test.com',
      passwordHash: hashPassword('password123'),
      fullName: 'Test Engineer',
      roleInCompany: 'site_engineer',
    },
  })
  console.log('Created/Updated site_engineer:', siteEngineer.email, '- Role:', siteEngineer.roleInCompany)

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: {
      roleInCompany: 'admin',
      passwordHash: hashPassword('password123'),
    },
    create: {
      email: 'admin@test.com',
      passwordHash: hashPassword('password123'),
      fullName: 'Test Admin',
      roleInCompany: 'admin',
    },
  })
  console.log('Created/Updated admin:', admin.email, '- Role:', admin.roleInCompany)

  console.log('\nAll test users created with password: password123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

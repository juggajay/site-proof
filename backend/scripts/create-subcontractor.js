import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

// Hash password function (same as in auth.ts)
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex')
}

async function main() {
  // Create Subcontractor A company
  const companyA = await prisma.company.upsert({
    where: { id: 'subcontractor-a-company-id' },
    update: {},
    create: {
      id: 'subcontractor-a-company-id',
      name: 'ABC Earthmoving Pty Ltd',
      abn: '12345678901',
    },
  })
  console.log('Created/Found Company A:', companyA.name)

  // Create Subcontractor B company
  const companyB = await prisma.company.upsert({
    where: { id: 'subcontractor-b-company-id' },
    update: {},
    create: {
      id: 'subcontractor-b-company-id',
      name: 'XYZ Concreting',
      abn: '98765432109',
    },
  })
  console.log('Created/Found Company B:', companyB.name)

  // Create Subcontractor A user
  const userA = await prisma.user.upsert({
    where: { email: 'subcontractorA@test.com' },
    update: {
      roleInCompany: 'subcontractor',
      companyId: companyA.id,
    },
    create: {
      email: 'subcontractorA@test.com',
      passwordHash: hashPassword('password123'),
      fullName: 'SubA User',
      roleInCompany: 'subcontractor',
      companyId: companyA.id,
    },
  })
  console.log('Created/Updated Subcontractor A user:', userA.email, '- Company:', companyA.name)

  // Create Subcontractor B user
  const userB = await prisma.user.upsert({
    where: { email: 'subcontractorB@test.com' },
    update: {
      roleInCompany: 'subcontractor',
      companyId: companyB.id,
    },
    create: {
      email: 'subcontractorB@test.com',
      passwordHash: hashPassword('password123'),
      fullName: 'SubB User',
      roleInCompany: 'subcontractor',
      companyId: companyB.id,
    },
  })
  console.log('Created/Updated Subcontractor B user:', userB.email, '- Company:', companyB.name)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

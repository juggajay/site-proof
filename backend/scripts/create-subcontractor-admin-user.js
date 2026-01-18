import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex')
}

async function main() {
  // Check if subcontractor_admin user exists
  let user = await prisma.user.findUnique({
    where: { email: 'subcontractor-admin@test.com' }
  })

  if (user) {
    console.log('Subcontractor admin user already exists, updating...')
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        roleInCompany: 'subcontractor_admin',
        emailVerified: true,
        emailVerifiedAt: new Date(),
        passwordHash: hashPassword('password123')
      }
    })
  } else {
    // Create subcontractor_admin user
    user = await prisma.user.create({
      data: {
        email: 'subcontractor-admin@test.com',
        fullName: 'Subcontractor Admin Test',
        passwordHash: hashPassword('password123'),
        roleInCompany: 'subcontractor_admin',
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    })
    console.log('Created subcontractor admin user:', user.email)
  }

  // Check if already in a project
  const existingProjectUser = await prisma.projectUser.findFirst({
    where: { userId: user.id }
  })

  if (!existingProjectUser) {
    // Find a project to add them to
    const project = await prisma.project.findFirst()

    if (project) {
      // Add user to project as subcontractor_admin
      await prisma.projectUser.create({
        data: {
          projectId: project.id,
          userId: user.id,
          role: 'subcontractor_admin'
        }
      })
      console.log('Added subcontractor admin to project:', project.name)
    }
  } else {
    console.log('Subcontractor admin already in a project')
  }

  console.log('Subcontractor admin user ready: subcontractor-admin@test.com / password123')
}

main().catch(console.error).finally(() => prisma.$disconnect())

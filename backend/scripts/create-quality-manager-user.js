import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex')
}

async function main() {
  // Check if quality manager user exists
  let user = await prisma.user.findUnique({
    where: { email: 'quality-manager@test.com' }
  })

  if (user) {
    console.log('Quality manager user already exists, updating...')
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        roleInCompany: 'quality_manager',
        emailVerified: true,
        emailVerifiedAt: new Date(),
        passwordHash: hashPassword('password123')
      }
    })
  } else {
    // Create quality manager user
    user = await prisma.user.create({
      data: {
        email: 'quality-manager@test.com',
        fullName: 'Quality Manager Test',
        passwordHash: hashPassword('password123'),
        roleInCompany: 'quality_manager',
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    })
    console.log('Created quality manager user:', user.email)
  }

  // Check if already in a project
  const existingProjectUser = await prisma.projectUser.findFirst({
    where: { userId: user.id }
  })

  if (!existingProjectUser) {
    // Find a project to add them to
    const project = await prisma.project.findFirst()

    if (project) {
      // Add user to project as quality_manager
      await prisma.projectUser.create({
        data: {
          projectId: project.id,
          userId: user.id,
          role: 'quality_manager'
        }
      })
      console.log('Added quality manager to project:', project.name)
    }
  } else {
    console.log('Quality manager already in a project')
  }

  console.log('Quality manager user ready: quality-manager@test.com / password123')
}

main().catch(console.error).finally(() => prisma.$disconnect())

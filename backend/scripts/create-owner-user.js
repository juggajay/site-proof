import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex')
}

async function main() {
  // Check if owner user exists
  let user = await prisma.user.findUnique({
    where: { email: 'owner@test.com' }
  })

  if (user) {
    console.log('Owner user already exists, updating...')
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        roleInCompany: 'owner',
        emailVerified: true,
        emailVerifiedAt: new Date(),
        passwordHash: hashPassword('password123')
      }
    })
  } else {
    // Create owner user
    user = await prisma.user.create({
      data: {
        email: 'owner@test.com',
        fullName: 'Owner Test',
        passwordHash: hashPassword('password123'),
        roleInCompany: 'owner',
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    })
    console.log('Created owner user:', user.email)
  }

  // Check if already in a project
  const existingProjectUser = await prisma.projectUser.findFirst({
    where: { userId: user.id }
  })

  if (!existingProjectUser) {
    // Find a project to add them to
    const project = await prisma.project.findFirst()

    if (project) {
      // Add user to project as owner
      await prisma.projectUser.create({
        data: {
          projectId: project.id,
          userId: user.id,
          role: 'owner'
        }
      })
      console.log('Added owner to project:', project.name)
    }
  } else {
    console.log('Owner already in a project')
  }

  console.log('Owner user ready: owner@test.com / password123')
}

main().catch(console.error).finally(() => prisma.$disconnect())

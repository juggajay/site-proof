import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex')
}

async function main() {
  // Check if viewer user exists
  let user = await prisma.user.findUnique({
    where: { email: 'viewer@test.com' }
  })

  if (user) {
    console.log('Viewer user already exists, updating...')
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        roleInCompany: 'viewer',
        emailVerified: true,
        emailVerifiedAt: new Date(),
        passwordHash: hashPassword('password123')
      }
    })
  } else {
    // Create viewer user
    user = await prisma.user.create({
      data: {
        email: 'viewer@test.com',
        fullName: 'Viewer Test',
        passwordHash: hashPassword('password123'),
        roleInCompany: 'viewer',
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    })
    console.log('Created viewer user:', user.email)
  }

  // Check if already in a project
  const existingProjectUser = await prisma.projectUser.findFirst({
    where: { userId: user.id }
  })

  if (!existingProjectUser) {
    // Find a project to add them to
    const project = await prisma.project.findFirst()

    if (project) {
      // Add user to project as viewer
      await prisma.projectUser.create({
        data: {
          projectId: project.id,
          userId: user.id,
          role: 'viewer'
        }
      })
      console.log('Added viewer to project:', project.name)
    }
  } else {
    console.log('Viewer already in a project')
  }

  console.log('Viewer user ready: viewer@test.com / password123')
}

main().catch(console.error).finally(() => prisma.$disconnect())

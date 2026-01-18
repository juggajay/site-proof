import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex')
}

async function main() {
  // Check if project manager user exists
  let user = await prisma.user.findUnique({
    where: { email: 'project-manager@test.com' }
  })

  if (user) {
    console.log('Project manager user already exists, updating...')
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        roleInCompany: 'project_manager',
        emailVerified: true,
        emailVerifiedAt: new Date(),
        passwordHash: hashPassword('password123')
      }
    })
  } else {
    // Create project manager user
    user = await prisma.user.create({
      data: {
        email: 'project-manager@test.com',
        fullName: 'Project Manager Test',
        passwordHash: hashPassword('password123'),
        roleInCompany: 'project_manager',
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    })
    console.log('Created project manager user:', user.email)
  }

  // Check if already in a project
  const existingProjectUser = await prisma.projectUser.findFirst({
    where: { userId: user.id }
  })

  if (!existingProjectUser) {
    // Find a project to add them to
    const project = await prisma.project.findFirst()

    if (project) {
      // Add user to project as project_manager
      await prisma.projectUser.create({
        data: {
          projectId: project.id,
          userId: user.id,
          role: 'project_manager'
        }
      })
      console.log('Added project manager to project:', project.name)
    }
  } else {
    console.log('Project manager already in a project')
  }

  console.log('Project manager user ready: project-manager@test.com / password123')
}

main().catch(console.error).finally(() => prisma.$disconnect())

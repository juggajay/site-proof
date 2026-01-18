import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex')
}

async function main() {
  // Check if subcontractor user exists
  let user = await prisma.user.findUnique({
    where: { email: 'subcontractor@test.com' }
  })

  if (user) {
    console.log('Subcontractor user already exists, updating...')
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        roleInCompany: 'subcontractor',
        emailVerified: true,
        emailVerifiedAt: new Date(),
        passwordHash: hashPassword('password123')
      }
    })
  } else {
    // Create subcontractor user
    user = await prisma.user.create({
      data: {
        email: 'subcontractor@test.com',
        fullName: 'Subcontractor User Test',
        passwordHash: hashPassword('password123'),
        roleInCompany: 'subcontractor',
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    })
    console.log('Created subcontractor user:', user.email)
  }

  // Check if already in a project
  const existingProjectUser = await prisma.projectUser.findFirst({
    where: { userId: user.id }
  })

  if (!existingProjectUser) {
    // Find a project to add them to
    const project = await prisma.project.findFirst()

    if (project) {
      // Add user to project as subcontractor
      await prisma.projectUser.create({
        data: {
          projectId: project.id,
          userId: user.id,
          role: 'subcontractor'
        }
      })
      console.log('Added subcontractor to project:', project.name)
    }
  } else {
    console.log('Subcontractor already in a project')
  }

  console.log('Subcontractor user ready: subcontractor@test.com / password123')
}

main().catch(console.error).finally(() => prisma.$disconnect())

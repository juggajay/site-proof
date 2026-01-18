import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex')
}

async function main() {
  // Check if foreman user exists
  let user = await prisma.user.findUnique({
    where: { email: 'foreman@test.com' }
  })

  if (user) {
    console.log('Foreman user already exists, updating...')
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        roleInCompany: 'foreman',
        emailVerified: true,
        emailVerifiedAt: new Date(),
        passwordHash: hashPassword('password123')
      }
    })
  } else {
    // Create foreman user
    user = await prisma.user.create({
      data: {
        email: 'foreman@test.com',
        fullName: 'Foreman Test',
        passwordHash: hashPassword('password123'),
        roleInCompany: 'foreman',
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    })
    console.log('Created foreman user:', user.email)
  }

  // Check if already in a project
  const existingProjectUser = await prisma.projectUser.findFirst({
    where: { userId: user.id }
  })

  if (!existingProjectUser) {
    // Find a project to add them to
    const project = await prisma.project.findFirst()

    if (project) {
      // Add user to project as foreman
      await prisma.projectUser.create({
        data: {
          projectId: project.id,
          userId: user.id,
          role: 'foreman'
        }
      })
      console.log('Added foreman to project:', project.name)
    }
  } else {
    console.log('Foreman already in a project')
  }

  console.log('Foreman user ready: foreman@test.com / password123')
}

main().catch(console.error).finally(() => prisma.$disconnect())

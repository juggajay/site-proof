import { PrismaClient } from '@prisma/client'
import { createHash } from 'crypto'

const prisma = new PrismaClient()

// Simple hash function using crypto (available in Node.js)
function simpleHash(password) {
  // For testing purposes only - in production use bcryptjs
  return createHash('sha256').update(password + 'siteproof-salt').digest('hex')
}

async function main() {
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: 'site-engineer@test.com' }
  })

  if (existingUser) {
    console.log('Site engineer user already exists:', existingUser.email)

    // Update their role and verify email
    const updated = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        roleInCompany: 'site_engineer',
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    })
    console.log('Updated user role to site_engineer')
    return
  }

  // Get an existing user to copy their password hash (for consistent auth)
  const adminUser = await prisma.user.findFirst({
    where: { email: { contains: 'admin' } }
  })

  if (!adminUser) {
    console.log('No admin user found to copy password from')
    return
  }

  // Create new site engineer user with same password as admin
  const user = await prisma.user.create({
    data: {
      email: 'site-engineer@test.com',
      fullName: 'Site Engineer Test',
      password: adminUser.password, // Use same password hash
      roleInCompany: 'site_engineer',
      emailVerified: true,
      emailVerifiedAt: new Date()
    }
  })

  console.log('Created site engineer user:', user.email)
  console.log('Uses same password as admin@test.com')

  // Find a project to add them to
  const project = await prisma.project.findFirst()

  if (project) {
    // Add user to project as site_engineer
    await prisma.projectUser.create({
      data: {
        projectId: project.id,
        userId: user.id,
        role: 'site_engineer'
      }
    })
    console.log('Added site engineer to project:', project.name)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())

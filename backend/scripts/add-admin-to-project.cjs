/**
 * Add admin user to the Cumulative Chart Test Project
 */

const path = require('path')
process.env.DATABASE_URL = 'file:' + path.join(__dirname, '..', 'prisma', 'dev.db')

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Find admin user
  const adminUser = await prisma.user.findUnique({
    where: { email: 'admin@test.com' }
  })

  if (!adminUser) {
    console.log('Admin user not found')
    return
  }

  // Find the test project
  const project = await prisma.project.findFirst({
    where: { projectNumber: 'CUMUL-TEST-001' }
  })

  if (!project) {
    console.log('Test project not found')
    return
  }

  // Check if already a member
  const existing = await prisma.projectUser.findFirst({
    where: {
      projectId: project.id,
      userId: adminUser.id
    }
  })

  if (existing) {
    console.log('Admin user already has access to the project')
  } else {
    await prisma.projectUser.create({
      data: {
        projectId: project.id,
        userId: adminUser.id,
        role: 'admin',
        status: 'active'
      }
    })
    console.log('Added admin user to project')
  }

  console.log('Project ID:', project.id)
  console.log('Project Name:', project.name)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

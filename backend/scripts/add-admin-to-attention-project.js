import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Find admin user
  const adminUser = await prisma.user.findFirst({
    where: { email: 'admin@test.com' }
  })

  if (!adminUser) {
    console.log('Admin user not found')
    return
  }

  // Find attention test project
  const attentionProject = await prisma.project.findFirst({
    where: { name: 'Attention Test Project' }
  })

  if (!attentionProject) {
    console.log('Attention Test Project not found')
    return
  }

  // Check if already added
  const existing = await prisma.projectUser.findFirst({
    where: { projectId: attentionProject.id, userId: adminUser.id }
  })

  if (existing) {
    console.log('Admin user already has access to Attention Test Project')
    return
  }

  // Add admin to project
  await prisma.projectUser.create({
    data: {
      projectId: attentionProject.id,
      userId: adminUser.id,
      role: 'admin',
      status: 'active'
    }
  })

  console.log('Added admin user to Attention Test Project')

  // Verify
  const projectAccess = await prisma.projectUser.findMany({
    where: { userId: adminUser.id },
    include: { project: true }
  })

  console.log('\nProjects admin now has access to:')
  projectAccess.forEach(pa => {
    console.log(' -', pa.project.name)
  })
}

main().catch(console.error).finally(() => prisma.$disconnect())

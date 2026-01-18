import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findFirst({ where: { email: 'owner@test.com' } })
  if (!user) {
    console.log('User not found')
    return
  }

  const project = await prisma.project.findFirst({ where: { projectNumber: 'WPT-001' } })
  if (!project) {
    console.log('Project not found')
    return
  }

  await prisma.projectUser.upsert({
    where: { projectId_userId: { projectId: project.id, userId: user.id } },
    update: {},
    create: { projectId: project.id, userId: user.id, role: 'project_manager', status: 'active' }
  })

  console.log('Added', user.email, 'to project', project.name)
}

main().catch(console.error).finally(() => prisma.$disconnect())

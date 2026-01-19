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

  console.log('Admin user:', adminUser.id, adminUser.email)

  // Get projects admin has access to
  const projectAccess = await prisma.projectUser.findMany({
    where: { userId: adminUser.id },
    include: { project: true }
  })

  console.log('\nProjects admin has access to:')
  const projectIds = projectAccess.map(pa => {
    console.log(' -', pa.project.name, '(', pa.project.id, ')')
    return pa.projectId
  })

  // Check for overdue NCRs in these projects
  const today = new Date()
  const overdueNCRs = await prisma.nCR.findMany({
    where: {
      projectId: { in: projectIds },
      status: { notIn: ['closed', 'closed_concession'] },
      dueDate: { lt: today }
    },
    include: { project: true }
  })

  console.log('\nOverdue NCRs in accessible projects:', overdueNCRs.length)
  overdueNCRs.forEach(ncr => {
    const daysOverdue = Math.ceil((today.getTime() - ncr.dueDate.getTime()) / (1000 * 60 * 60 * 24))
    console.log(` - ${ncr.ncrNumber}: ${daysOverdue} days overdue (project: ${ncr.project.name})`)
  })

  // Check all NCRs with due dates
  console.log('\n\nAll NCRs with due dates (any project):')
  const allNCRsWithDueDates = await prisma.nCR.findMany({
    where: { dueDate: { not: null } },
    include: { project: true }
  })

  allNCRsWithDueDates.forEach(ncr => {
    const daysFromNow = Math.ceil((ncr.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    const isOverdue = daysFromNow < 0
    console.log(` - ${ncr.ncrNumber}: ${isOverdue ? Math.abs(daysFromNow) + ' days OVERDUE' : daysFromNow + ' days until due'} (project: ${ncr.project.name}, status: ${ncr.status})`)
  })
}

main().catch(console.error).finally(() => prisma.$disconnect())

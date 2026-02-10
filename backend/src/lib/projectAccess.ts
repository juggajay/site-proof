import { prisma } from './prisma.js'

/**
 * Check if a user has access to a project.
 * - Admin/owner users can access any project in their company.
 * - Other users need an explicit ProjectUser record.
 * - Subcontractor users get access via SubcontractorUser + portal permissions.
 */
export async function checkProjectAccess(userId: string, projectId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return false

  // Admin/owner users can access all projects in their company
  if (user.roleInCompany === 'admin' || user.roleInCompany === 'owner') {
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (project?.companyId === user.companyId) {
      return true
    }
  }

  // Check explicit project membership
  const projectUser = await prisma.projectUser.findUnique({
    where: { projectId_userId: { projectId, userId } }
  })
  if (projectUser) return true

  // Check subcontractor access
  const subcontractorUser = await prisma.subcontractorUser.findFirst({
    where: { userId },
    include: { subcontractorCompany: true }
  })

  if (subcontractorUser) {
    const company = subcontractorUser.subcontractorCompany
    if (company.projectId === projectId) {
      return true
    }
  }

  return false
}

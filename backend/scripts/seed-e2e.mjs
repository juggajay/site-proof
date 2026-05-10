import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const password = 'testpassword123'
const passwordHash = bcrypt.hashSync(password, 12)

const ids = {
  company: 'e2e-company',
  adminUser: 'e2e-admin-user',
  subcontractorUser: 'e2e-subcontractor-user',
  project: 'e2e-project',
  projectUser: 'e2e-project-user',
  subcontractorCompany: 'e2e-subcontractor-company',
  subcontractorMember: 'e2e-subcontractor-member',
  lot: 'e2e-lot',
  itpTemplate: 'e2e-itp-template',
  itpChecklistItem: 'e2e-itp-checklist-item',
  itpInstance: 'e2e-itp-instance',
  holdPoint: 'e2e-hold-point',
  diary: 'e2e-diary',
  docket: 'e2e-docket',
}

async function upsertItpCompletion(itpInstanceId, checklistItemId) {
  const existing = await prisma.iTPCompletion.findFirst({
    where: { itpInstanceId, checklistItemId },
    select: { id: true },
  })

  if (existing) {
    return prisma.iTPCompletion.update({
      where: { id: existing.id },
      data: { status: 'pending', verificationStatus: 'none' },
    })
  }

  return prisma.iTPCompletion.create({
    data: {
      itpInstanceId,
      checklistItemId,
      status: 'pending',
      verificationStatus: 'none',
    },
  })
}

async function main() {
  const now = new Date()

  const company = await prisma.company.upsert({
    where: { id: ids.company },
    update: {
      name: 'E2E Civil Pty Ltd',
      subscriptionTier: 'enterprise',
    },
    create: {
      id: ids.company,
      name: 'E2E Civil Pty Ltd',
      subscriptionTier: 'enterprise',
    },
  })

  const adminUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {
      passwordHash,
      fullName: 'E2E Admin',
      companyId: company.id,
      roleInCompany: 'admin',
      emailVerified: true,
      emailVerifiedAt: now,
      tosAcceptedAt: now,
      tosVersion: 'e2e',
    },
    create: {
      id: ids.adminUser,
      email: 'test@example.com',
      passwordHash,
      fullName: 'E2E Admin',
      companyId: company.id,
      roleInCompany: 'admin',
      emailVerified: true,
      emailVerifiedAt: now,
      tosAcceptedAt: now,
      tosVersion: 'e2e',
    },
  })

  const project = await prisma.project.upsert({
    where: { id: ids.project },
    update: {
      companyId: company.id,
      name: 'E2E Highway Upgrade',
      projectNumber: 'E2E-001',
      status: 'active',
      state: 'NSW',
      specificationSet: 'TfNSW',
    },
    create: {
      id: ids.project,
      companyId: company.id,
      name: 'E2E Highway Upgrade',
      projectNumber: 'E2E-001',
      status: 'active',
      state: 'NSW',
      specificationSet: 'TfNSW',
    },
  })

  await prisma.projectUser.upsert({
    where: { id: ids.projectUser },
    update: {
      projectId: project.id,
      userId: adminUser.id,
      role: 'project_manager',
      status: 'active',
      acceptedAt: now,
    },
    create: {
      id: ids.projectUser,
      projectId: project.id,
      userId: adminUser.id,
      role: 'project_manager',
      status: 'active',
      acceptedAt: now,
    },
  })

  const subcontractorCompany = await prisma.subcontractorCompany.upsert({
    where: { id: ids.subcontractorCompany },
    update: {
      projectId: project.id,
      companyName: 'E2E Subcontractors',
      status: 'approved',
      approvedById: adminUser.id,
      approvedAt: now,
    },
    create: {
      id: ids.subcontractorCompany,
      projectId: project.id,
      companyName: 'E2E Subcontractors',
      status: 'approved',
      approvedById: adminUser.id,
      approvedAt: now,
    },
  })

  const subcontractorUser = await prisma.user.upsert({
    where: { email: 'subcontractor@example.com' },
    update: {
      passwordHash,
      fullName: 'E2E Subcontractor',
      roleInCompany: 'subcontractor_admin',
      emailVerified: true,
      emailVerifiedAt: now,
      tosAcceptedAt: now,
      tosVersion: 'e2e',
    },
    create: {
      id: ids.subcontractorUser,
      email: 'subcontractor@example.com',
      passwordHash,
      fullName: 'E2E Subcontractor',
      roleInCompany: 'subcontractor_admin',
      emailVerified: true,
      emailVerifiedAt: now,
      tosAcceptedAt: now,
      tosVersion: 'e2e',
    },
  })

  await prisma.subcontractorUser.upsert({
    where: { id: ids.subcontractorMember },
    update: {
      subcontractorCompanyId: subcontractorCompany.id,
      userId: subcontractorUser.id,
      role: 'admin',
    },
    create: {
      id: ids.subcontractorMember,
      subcontractorCompanyId: subcontractorCompany.id,
      userId: subcontractorUser.id,
      role: 'admin',
    },
  })

  const template = await prisma.iTPTemplate.upsert({
    where: { id: ids.itpTemplate },
    update: {
      projectId: project.id,
      name: 'E2E Roadworks ITP',
      activityType: 'Earthworks',
      stateSpec: 'TfNSW',
      isActive: true,
    },
    create: {
      id: ids.itpTemplate,
      projectId: project.id,
      name: 'E2E Roadworks ITP',
      activityType: 'Earthworks',
      stateSpec: 'TfNSW',
      isActive: true,
    },
  })

  const checklistItem = await prisma.iTPChecklistItem.upsert({
    where: { id: ids.itpChecklistItem },
    update: {
      templateId: template.id,
      sequenceNumber: 1,
      description: 'Verify formation is ready for inspection',
      acceptanceCriteria: 'Conforms to project specification',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
    },
    create: {
      id: ids.itpChecklistItem,
      templateId: template.id,
      sequenceNumber: 1,
      description: 'Verify formation is ready for inspection',
      acceptanceCriteria: 'Conforms to project specification',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
    },
  })

  const lot = await prisma.lot.upsert({
    where: { id: ids.lot },
    update: {
      projectId: project.id,
      lotNumber: 'LOT-001',
      lotType: 'roadworks',
      description: 'E2E test lot',
      status: 'in_progress',
      activityType: 'Earthworks',
      itpTemplateId: template.id,
      assignedSubcontractorId: subcontractorCompany.id,
    },
    create: {
      id: ids.lot,
      projectId: project.id,
      lotNumber: 'LOT-001',
      lotType: 'roadworks',
      description: 'E2E test lot',
      status: 'in_progress',
      activityType: 'Earthworks',
      itpTemplateId: template.id,
      assignedSubcontractorId: subcontractorCompany.id,
    },
  })

  const instance = await prisma.iTPInstance.upsert({
    where: { id: ids.itpInstance },
    update: {
      lotId: lot.id,
      templateId: template.id,
      status: 'in_progress',
    },
    create: {
      id: ids.itpInstance,
      lotId: lot.id,
      templateId: template.id,
      status: 'in_progress',
    },
  })

  await upsertItpCompletion(instance.id, checklistItem.id)

  await prisma.holdPoint.upsert({
    where: { id: ids.holdPoint },
    update: {
      lotId: lot.id,
      itpChecklistItemId: checklistItem.id,
      pointType: 'hold_point',
      description: 'E2E hold point',
      status: 'pending',
    },
    create: {
      id: ids.holdPoint,
      lotId: lot.id,
      itpChecklistItemId: checklistItem.id,
      pointType: 'hold_point',
      description: 'E2E hold point',
      status: 'pending',
    },
  })

  await prisma.dailyDiary.upsert({
    where: { id: ids.diary },
    update: {
      projectId: project.id,
      date: new Date('2026-01-15T00:00:00.000Z'),
      status: 'draft',
      weatherConditions: 'Fine',
      generalNotes: 'E2E seeded diary',
    },
    create: {
      id: ids.diary,
      projectId: project.id,
      date: new Date('2026-01-15T00:00:00.000Z'),
      status: 'draft',
      weatherConditions: 'Fine',
      generalNotes: 'E2E seeded diary',
    },
  })

  await prisma.dailyDocket.upsert({
    where: { id: ids.docket },
    update: {
      subcontractorCompanyId: subcontractorCompany.id,
      projectId: project.id,
      date: new Date('2026-01-15T00:00:00.000Z'),
      status: 'pending_approval',
      submittedById: subcontractorUser.id,
      submittedAt: now,
      notes: 'E2E seeded docket',
    },
    create: {
      id: ids.docket,
      subcontractorCompanyId: subcontractorCompany.id,
      projectId: project.id,
      date: new Date('2026-01-15T00:00:00.000Z'),
      status: 'pending_approval',
      submittedById: subcontractorUser.id,
      submittedAt: now,
      notes: 'E2E seeded docket',
    },
  })

  console.log(`Seeded E2E users: test@example.com and subcontractor@example.com (password: ${password})`)
}

main()
  .catch((error) => {
    console.error('Failed to seed E2E data:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

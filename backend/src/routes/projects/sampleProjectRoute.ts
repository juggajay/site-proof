import { Router, type Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { createAuditLog, AuditAction } from '../../lib/auditLog.js';
import { TIER_PROJECT_LIMITS } from '../../lib/tierLimits.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { buildProjectCreatedResponse } from './costResponses.js';
import {
  SAMPLE_CHECKLIST_ITEMS,
  SAMPLE_HOLD_POINT_ITEM_INDEX,
  SAMPLE_ITP_TEMPLATE,
  SAMPLE_LOTS,
  SAMPLE_NCR,
  SAMPLE_PROJECT,
  SAMPLE_PROJECT_NUMBER,
  SAMPLE_TEST_RESULTS,
} from './sampleProjectData.js';

type AuthenticatedUser = NonNullable<Request['user']>;

type SampleProjectRouterDependencies = {
  canCreateProjectForCompany: (user: AuthenticatedUser) => boolean;
  hasSubcontractorProjectIdentity: (user: AuthenticatedUser) => Promise<boolean>;
};

const PROJECT_SUMMARY_SELECT = {
  id: true,
  name: true,
  projectNumber: true,
  status: true,
  createdAt: true,
} as const;

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/** Days-ago helper so the seeded history reads like a real fortnight on site. */
function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function findExistingSampleProject(companyId: string) {
  return prisma.project.findFirst({
    where: { companyId, projectNumber: SAMPLE_PROJECT_NUMBER },
    select: PROJECT_SUMMARY_SELECT,
  });
}

/** Make sure the caller can open the sample project they were handed back. */
async function ensureProjectMembership(projectId: string, userId: string) {
  await prisma.projectUser.upsert({
    where: { projectId_userId: { projectId, userId } },
    update: { status: 'active', acceptedAt: new Date() },
    create: {
      projectId,
      userId,
      role: 'admin',
      status: 'active',
      acceptedAt: new Date(),
    },
  });
}

async function seedSampleProject(user: AuthenticatedUser, companyId: string) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        companyId,
        name: SAMPLE_PROJECT.name,
        projectNumber: SAMPLE_PROJECT.projectNumber,
        clientName: SAMPLE_PROJECT.clientName,
        status: SAMPLE_PROJECT.status,
        state: SAMPLE_PROJECT.state,
        specificationSet: SAMPLE_PROJECT.specificationSet,
        chainageStart: SAMPLE_PROJECT.chainageStart,
        chainageEnd: SAMPLE_PROJECT.chainageEnd,
        startDate: daysAgo(14),
        settings: JSON.stringify(SAMPLE_PROJECT.settings),
      },
      select: PROJECT_SUMMARY_SELECT,
    });

    await tx.projectUser.create({
      data: {
        projectId: project.id,
        userId: user.id,
        role: 'admin',
        status: 'active',
        acceptedAt: new Date(),
      },
    });

    // Project-owned ITP template so the sample never depends on the global
    // template library being seeded.
    const template = await tx.iTPTemplate.create({
      data: {
        projectId: project.id,
        name: SAMPLE_ITP_TEMPLATE.name,
        description: SAMPLE_ITP_TEMPLATE.description,
        activityType: SAMPLE_ITP_TEMPLATE.activityType,
        specificationReference: SAMPLE_ITP_TEMPLATE.specificationReference,
        checklistItems: { create: SAMPLE_CHECKLIST_ITEMS },
      },
      include: { checklistItems: { orderBy: { sequenceNumber: 'asc' } } },
    });

    const holdPointItem = template.checklistItems[SAMPLE_HOLD_POINT_ITEM_INDEX];

    // Same snapshot shape the ITP assignment route writes (itp/instances.ts),
    // so the checklist UI renders the sample instances identically.
    const templateSnapshot = JSON.stringify({
      id: template.id,
      name: template.name,
      description: template.description,
      activityType: template.activityType,
      checklistItems: template.checklistItems.map((item) => ({
        id: item.id,
        description: item.description,
        sequenceNumber: item.sequenceNumber,
        pointType: item.pointType,
        responsibleParty: item.responsibleParty,
        evidenceRequired: item.evidenceRequired,
        acceptanceCriteria: item.acceptanceCriteria,
        testType: item.testType,
      })),
    });

    const lotIdsByNumber = new Map<string, string>();

    for (const lotSeed of SAMPLE_LOTS) {
      const isConformed = lotSeed.status === 'conformed';
      const lot = await tx.lot.create({
        data: {
          projectId: project.id,
          lotNumber: lotSeed.lotNumber,
          description: lotSeed.description,
          lotType: lotSeed.lotType,
          activityType: lotSeed.activityType,
          status: lotSeed.status,
          budgetAmount: lotSeed.budgetAmount,
          chainageStart: lotSeed.chainageStart,
          chainageEnd: lotSeed.chainageEnd,
          areaZone: lotSeed.areaZone,
          createdById: user.id,
          itpTemplateId: lotSeed.itp ? template.id : null,
          conformedAt: isConformed ? daysAgo(1) : null,
          conformedById: isConformed ? user.id : null,
        },
        select: { id: true },
      });
      lotIdsByNumber.set(lotSeed.lotNumber, lot.id);

      if (lotSeed.itp) {
        const completedItems =
          lotSeed.itp === 'complete'
            ? template.checklistItems
            : template.checklistItems.filter(
                (item) => item.sequenceNumber < holdPointItem.sequenceNumber,
              );

        await tx.iTPInstance.create({
          data: {
            lotId: lot.id,
            templateId: template.id,
            templateSnapshot,
            status: lotSeed.itp === 'complete' ? 'completed' : 'in_progress',
            completions: {
              create: completedItems.map((item) => ({
                checklistItemId: item.id,
                status: 'completed',
                completedById: user.id,
                completedAt: daysAgo(lotSeed.itp === 'complete' ? 3 : 1),
              })),
            },
          },
        });
      }

      if (lotSeed.holdPoint) {
        const released = lotSeed.holdPoint === 'released';
        await tx.holdPoint.create({
          data: {
            lotId: lot.id,
            itpChecklistItemId: holdPointItem.id,
            pointType: 'hold_point',
            description: holdPointItem.description,
            status: released ? 'released' : 'requested',
            notificationSentAt: daysAgo(released ? 4 : 1),
            notificationSentTo: 'superintendent@example.com',
            releasedAt: released ? daysAgo(3) : null,
            releasedByName: released ? 'S. Patel' : null,
            releasedByOrg: released ? 'Riverside Shire Council (example)' : null,
            releaseMethod: released ? 'email' : null,
            releaseNotes: released ? 'Subgrade accepted. Proceed with fill placement.' : null,
          },
        });
      }
    }

    const ncrLotId = lotIdsByNumber.get(SAMPLE_NCR.lotNumber);
    await tx.nCR.create({
      data: {
        projectId: project.id,
        ncrNumber: SAMPLE_NCR.ncrNumber,
        description: SAMPLE_NCR.description,
        category: SAMPLE_NCR.category,
        severity: SAMPLE_NCR.severity,
        status: SAMPLE_NCR.status,
        specificationReference: SAMPLE_NCR.specificationReference,
        raisedById: user.id,
        raisedAt: daysAgo(2),
        dueDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
        ...(ncrLotId ? { ncrLots: { create: { lotId: ncrLotId } } } : {}),
      },
    });

    for (const testSeed of SAMPLE_TEST_RESULTS) {
      const verified = testSeed.status === 'verified';
      await tx.testResult.create({
        data: {
          projectId: project.id,
          lotId: lotIdsByNumber.get(testSeed.lotNumber),
          testType: testSeed.testType,
          status: testSeed.status,
          passFail: testSeed.passFail,
          resultValue: testSeed.resultValue,
          resultUnit: testSeed.resultUnit,
          specificationMin: testSeed.specificationMin,
          specificationMax: testSeed.specificationMax,
          laboratoryName: testSeed.laboratoryName,
          sampleLocation: testSeed.sampleLocation,
          sampleDate: daysAgo(verified ? 5 : 1),
          testDate: verified ? daysAgo(4) : null,
          resultDate: verified ? daysAgo(3) : null,
          enteredById: verified ? user.id : null,
          enteredAt: verified ? daysAgo(3) : null,
          verifiedById: verified ? user.id : null,
          verifiedAt: verified ? daysAgo(2) : null,
        },
      });
    }

    return project;
  });
}

export function createSampleProjectRouter({
  canCreateProjectForCompany,
  hasSubcontractorProjectIdentity,
}: SampleProjectRouterDependencies) {
  const sampleProjectRouter = Router();

  sampleProjectRouter.use(requireAuth);

  // POST /api/projects/sample - Seed (or return) the company's example project.
  // Idempotent per company: the reserved project number SAMPLE-001 plus the
  // existing @@unique([companyId, projectNumber]) constraint guarantee at most
  // one sample project, including under concurrent requests.
  sampleProjectRouter.post(
    '/sample',
    asyncHandler(async (req, res) => {
      const user = req.user!;

      if (await hasSubcontractorProjectIdentity(user)) {
        throw AppError.forbidden('Subcontractor portal users cannot create company projects');
      }

      if (!user.companyId) {
        throw AppError.forbidden('Users must belong to an organization before creating projects');
      }

      if (!canCreateProjectForCompany(user)) {
        throw AppError.forbidden('Only company admins and project managers can create projects');
      }

      const companyId = user.companyId;

      const existing = await findExistingSampleProject(companyId);
      if (existing) {
        await ensureProjectMembership(existing.id, user.id);
        res.json({ ...buildProjectCreatedResponse(existing), alreadyExisted: true });
        return;
      }

      // Same tier ceiling as POST /api/projects — the example project is a
      // real project and counts toward the plan limit.
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { subscriptionTier: true },
      });

      if (company) {
        const tier = company.subscriptionTier || 'basic';
        const limit = TIER_PROJECT_LIMITS[tier] || TIER_PROJECT_LIMITS.basic;
        const projectCount = await prisma.project.count({ where: { companyId } });

        if (projectCount >= limit) {
          throw AppError.forbidden(
            `Your ${tier} subscription allows up to ${limit} projects. Please upgrade to create more projects.`,
          );
        }
      }

      let project;
      try {
        project = await seedSampleProject(user, companyId);
      } catch (error) {
        if (isUniqueConstraintViolation(error)) {
          // Lost a race with a concurrent request — hand back the winner's.
          const raceWinner = await findExistingSampleProject(companyId);
          if (raceWinner) {
            await ensureProjectMembership(raceWinner.id, user.id);
            res.json({ ...buildProjectCreatedResponse(raceWinner), alreadyExisted: true });
            return;
          }
        }
        throw error;
      }

      await createAuditLog({
        projectId: project.id,
        userId: user.id,
        entityType: 'project',
        entityId: project.id,
        action: AuditAction.PROJECT_CREATED,
        changes: {
          name: project.name,
          projectNumber: project.projectNumber,
          sampleProject: true,
        },
        req,
      });

      res.status(201).json({ ...buildProjectCreatedResponse(project), alreadyExisted: false });
    }),
  );

  return sampleProjectRouter;
}

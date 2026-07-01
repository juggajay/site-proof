import { Prisma } from '@prisma/client';

type ScheduledReportCleanupClient = {
  scheduledReport: {
    updateMany(args: Prisma.ScheduledReportUpdateManyArgs): Promise<Prisma.BatchPayload>;
  };
};

type DisableOwnedScheduledReportsParams =
  | {
      userId: string;
      projectId: string;
      companyId?: never;
    }
  | {
      userId: string;
      companyId: string;
      projectId?: never;
    };

const SCHEDULED_REPORT_MANAGER_ROLES = ['owner', 'admin', 'project_manager'];

function disabledScheduleData(): Prisma.ScheduledReportUpdateManyArgs['data'] {
  return {
    isActive: false,
    recipients: '',
    createdById: null,
  };
}

export async function disableOwnedScheduledReportsForAccessRemoval(
  client: ScheduledReportCleanupClient,
  params: DisableOwnedScheduledReportsParams,
): Promise<number> {
  const scopeWhere: Prisma.ScheduledReportWhereInput =
    'projectId' in params
      ? { projectId: params.projectId }
      : { project: { companyId: params.companyId } };

  const result = await client.scheduledReport.updateMany({
    where: {
      createdById: params.userId,
      ...scopeWhere,
    },
    data: disabledScheduleData(),
  });

  return result.count;
}

export async function disableOwnedScheduledReportsForProjectManagerDemotion(
  client: ScheduledReportCleanupClient,
  params: { userId: string; projectId: string },
): Promise<number> {
  const result = await client.scheduledReport.updateMany({
    where: {
      createdById: params.userId,
      projectId: params.projectId,
    },
    data: disabledScheduleData(),
  });

  return result.count;
}

export async function disableOwnedScheduledReportsForCompanyManagerDemotion(
  client: ScheduledReportCleanupClient,
  params: { userId: string; companyId: string },
): Promise<number> {
  const result = await client.scheduledReport.updateMany({
    where: {
      createdById: params.userId,
      project: {
        companyId: params.companyId,
        projectUsers: {
          none: {
            userId: params.userId,
            status: 'active',
            role: { in: SCHEDULED_REPORT_MANAGER_ROLES },
          },
        },
      },
    },
    data: disabledScheduleData(),
  });

  return result.count;
}

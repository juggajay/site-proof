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
    data: {
      isActive: false,
      recipients: '',
      createdById: null,
    },
  });

  return result.count;
}

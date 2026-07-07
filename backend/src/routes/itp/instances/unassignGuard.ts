import { AppError } from '../../../lib/AppError.js';

export const ITP_INSTANCE_HAS_RECORDED_WORK_CODE = 'ITP_INSTANCE_HAS_RECORDED_WORK';

export interface ItpInstanceUnassignScope {
  instanceId: string;
  lotId: string;
  templateId: string;
}

export interface ItpInstanceRecordedWorkCounts {
  completionCount: number;
  holdPointCount: number;
  testResultCount: number;
}

/** Structural slice of the Prisma client used by the unassign guard. */
export interface ItpInstanceUnassignGuardClient {
  iTPCompletion: {
    count: (args: { where: { itpInstanceId: string } }) => Promise<number>;
  };
  holdPoint: {
    count: (args: {
      where: { lotId: string; itpChecklistItem: { templateId: string } };
    }) => Promise<number>;
  };
  testResult: {
    count: (args: {
      where: { lotId: string; itpChecklistItem: { templateId: string } };
    }) => Promise<number>;
  };
}

export async function countItpInstanceRecordedWork(
  client: ItpInstanceUnassignGuardClient,
  scope: ItpInstanceUnassignScope,
): Promise<ItpInstanceRecordedWorkCounts> {
  const [completionCount, holdPointCount, testResultCount] = await Promise.all([
    client.iTPCompletion.count({
      where: { itpInstanceId: scope.instanceId },
    }),
    client.holdPoint.count({
      where: {
        lotId: scope.lotId,
        itpChecklistItem: { templateId: scope.templateId },
      },
    }),
    client.testResult.count({
      where: {
        lotId: scope.lotId,
        itpChecklistItem: { templateId: scope.templateId },
      },
    }),
  ]);

  return { completionCount, holdPointCount, testResultCount };
}

export function hasItpInstanceRecordedWork(counts: ItpInstanceRecordedWorkCounts): boolean {
  return counts.completionCount > 0 || counts.holdPointCount > 0 || counts.testResultCount > 0;
}

export function buildItpInstanceRecordedWorkMessage(): string {
  return (
    "This ITP has recorded work on this lot and can't be unassigned. " +
    'Remove the recorded completions, hold points, or test results before unassigning it.'
  );
}

export async function assertItpInstanceUnassignable(
  client: ItpInstanceUnassignGuardClient,
  scope: ItpInstanceUnassignScope,
): Promise<void> {
  const counts = await countItpInstanceRecordedWork(client, scope);
  if (!hasItpInstanceRecordedWork(counts)) {
    return;
  }

  throw AppError.conflict(buildItpInstanceRecordedWorkMessage(), {
    code: ITP_INSTANCE_HAS_RECORDED_WORK_CODE,
    ...counts,
  });
}

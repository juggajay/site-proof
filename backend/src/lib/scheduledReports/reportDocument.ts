import { prisma } from '../prisma.js';
import { buildFrontendUrl } from '../runtimeConfig.js';
import {
  isScheduledReportType,
  type ScheduledReportForDelivery,
  type ScheduledReportType,
} from './core.js';

const REPORT_TYPE_LABELS: Record<ScheduledReportType, string> = {
  'lot-status': 'Lot Status Report',
  ncr: 'NCR Report',
  test: 'Test Results Report',
  diary: 'Daily Diary Report',
};

type ScheduledReportDocument = {
  reportTypeLabel: string;
  reportName: string;
  lines: string[];
  viewReportUrl: string;
};

function countGroupsToRecord(
  groups: Array<Record<string, unknown> & { _count: number }>,
  key: string,
  fallback: string,
): Record<string, number> {
  return groups.reduce((acc: Record<string, number>, group) => {
    const value = group[key];
    const name = typeof value === 'string' && value.length > 0 ? value : fallback;
    acc[name] = group._count;
    return acc;
  }, {});
}

function formatCountLines(title: string, counts: Record<string, number>): string[] {
  const entries = Object.entries(counts).sort(([left], [right]) => left.localeCompare(right));
  if (entries.length === 0) {
    return [title, '- None'];
  }

  return [title, ...entries.map(([label, count]) => `- ${label}: ${count}`)];
}

function formatDate(value: Date | null | undefined): string {
  return value ? value.toISOString().slice(0, 10) : 'Not set';
}

function truncate(value: string | null | undefined, maxLength: number): string {
  const normalized = value?.replace(/\s+/g, ' ').trim() || '';
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
}

async function buildLotStatusLines(projectId: string): Promise<string[]> {
  const [total, statusGroups, activityGroups, lots] = await Promise.all([
    prisma.lot.count({ where: { projectId } }),
    prisma.lot.groupBy({
      by: ['status'],
      where: { projectId },
      _count: true,
    }),
    prisma.lot.groupBy({
      by: ['activityType'],
      where: { projectId },
      _count: true,
    }),
    prisma.lot.findMany({
      where: { projectId },
      select: {
        lotNumber: true,
        status: true,
        activityType: true,
        description: true,
        conformedAt: true,
      },
      orderBy: { lotNumber: 'asc' },
      take: 50,
    }),
  ]);

  const statusCounts = countGroupsToRecord(statusGroups, 'status', 'not_started');
  const activityCounts = countGroupsToRecord(activityGroups, 'activityType', 'Unknown');

  return [
    `Total lots: ${total}`,
    '',
    ...formatCountLines('Status counts', statusCounts),
    '',
    ...formatCountLines('Activity counts', activityCounts),
    '',
    'Lot sample',
    ...(lots.length === 0
      ? ['- No lots recorded']
      : lots.map(
          (lot) =>
            `- ${lot.lotNumber}: ${lot.status || 'not_started'} | ${lot.activityType || 'Unknown'} | ` +
            `${truncate(lot.description, 70) || 'No description'} | conformed ${formatDate(lot.conformedAt)}`,
        )),
  ];
}

async function buildNcrLines(projectId: string, now: Date): Promise<string[]> {
  const closedStatuses = ['closed', 'closed_concession'];
  const [total, statusGroups, categoryGroups, rootCauseGroups, overdueCount, ncrs] =
    await Promise.all([
      prisma.nCR.count({ where: { projectId } }),
      prisma.nCR.groupBy({
        by: ['status'],
        where: { projectId },
        _count: true,
      }),
      prisma.nCR.groupBy({
        by: ['category'],
        where: { projectId },
        _count: true,
      }),
      prisma.nCR.groupBy({
        by: ['rootCauseCategory'],
        where: { projectId },
        _count: true,
      }),
      prisma.nCR.count({
        where: {
          projectId,
          dueDate: { lt: now },
          status: { notIn: closedStatuses },
        },
      }),
      prisma.nCR.findMany({
        where: { projectId },
        select: {
          ncrNumber: true,
          description: true,
          category: true,
          status: true,
          dueDate: true,
          raisedAt: true,
        },
        orderBy: { raisedAt: 'desc' },
        take: 50,
      }),
    ]);

  return [
    `Total NCRs: ${total}`,
    `Overdue open NCRs: ${overdueCount}`,
    '',
    ...formatCountLines('Status counts', countGroupsToRecord(statusGroups, 'status', 'open')),
    '',
    ...formatCountLines(
      'Category counts',
      countGroupsToRecord(categoryGroups, 'category', 'minor'),
    ),
    '',
    ...formatCountLines(
      'Root cause counts',
      countGroupsToRecord(rootCauseGroups, 'rootCauseCategory', 'Not specified'),
    ),
    '',
    'NCR sample',
    ...(ncrs.length === 0
      ? ['- No NCRs recorded']
      : ncrs.map(
          (ncr) =>
            `- ${ncr.ncrNumber}: ${ncr.status} | ${ncr.category} | due ${formatDate(ncr.dueDate)} | ` +
            truncate(ncr.description, 90),
        )),
  ];
}

async function buildTestLines(projectId: string): Promise<string[]> {
  const [total, passFailGroups, testTypeGroups, statusGroups, tests] = await Promise.all([
    prisma.testResult.count({ where: { projectId } }),
    prisma.testResult.groupBy({
      by: ['passFail'],
      where: { projectId },
      _count: true,
    }),
    prisma.testResult.groupBy({
      by: ['testType'],
      where: { projectId },
      _count: true,
    }),
    prisma.testResult.groupBy({
      by: ['status'],
      where: { projectId },
      _count: true,
    }),
    prisma.testResult.findMany({
      where: { projectId },
      select: {
        testRequestNumber: true,
        testType: true,
        laboratoryName: true,
        sampleDate: true,
        resultDate: true,
        passFail: true,
        status: true,
      },
      orderBy: { sampleDate: 'desc' },
      take: 50,
    }),
  ]);

  const passFailCounts = countGroupsToRecord(passFailGroups, 'passFail', 'pending');
  const passRate = total > 0 ? (((passFailCounts.pass || 0) / total) * 100).toFixed(1) : '0.0';

  return [
    `Total tests: ${total}`,
    `Pass rate: ${passRate}%`,
    '',
    ...formatCountLines('Pass/fail counts', passFailCounts),
    '',
    ...formatCountLines(
      'Test type counts',
      countGroupsToRecord(testTypeGroups, 'testType', 'Unknown'),
    ),
    '',
    ...formatCountLines('Status counts', countGroupsToRecord(statusGroups, 'status', 'requested')),
    '',
    'Test sample',
    ...(tests.length === 0
      ? ['- No tests recorded']
      : tests.map(
          (test) =>
            `- ${test.testRequestNumber || 'No request #'}: ${test.testType} | ${test.passFail} | ` +
            `${test.status} | sampled ${formatDate(test.sampleDate)} | ${test.laboratoryName || 'No lab'}`,
        )),
  ];
}

async function buildDiaryLines(projectId: string): Promise<string[]> {
  const [total, statusGroups, diaries] = await Promise.all([
    prisma.dailyDiary.count({ where: { projectId } }),
    prisma.dailyDiary.groupBy({
      by: ['status'],
      where: { projectId },
      _count: true,
    }),
    prisma.dailyDiary.findMany({
      where: { projectId },
      select: {
        date: true,
        status: true,
        weatherConditions: true,
        isLate: true,
        submittedAt: true,
        submittedBy: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { date: 'desc' },
      take: 50,
    }),
  ]);

  return [
    `Total diaries: ${total}`,
    '',
    ...formatCountLines('Status counts', countGroupsToRecord(statusGroups, 'status', 'draft')),
    '',
    'Diary sample',
    ...(diaries.length === 0
      ? ['- No diaries recorded']
      : diaries.map(
          (diary) =>
            `- ${formatDate(diary.date)}: ${diary.status}${diary.isLate ? ' | late' : ''} | ` +
            `${diary.weatherConditions || 'No weather'} | ` +
            `${diary.submittedBy?.fullName || diary.submittedBy?.email || 'No submitter'} | ` +
            `submitted ${formatDate(diary.submittedAt)}`,
        )),
  ];
}

export async function buildScheduledReportDocument(
  schedule: ScheduledReportForDelivery,
  now: Date,
): Promise<ScheduledReportDocument> {
  if (!isScheduledReportType(schedule.reportType)) {
    throw new Error(`Unsupported scheduled report type: ${schedule.reportType}`);
  }

  const reportTypeLabel = REPORT_TYPE_LABELS[schedule.reportType];
  const reportName = `${reportTypeLabel} - ${schedule.project.name}`;
  const viewReportUrl = buildFrontendUrl(
    `/projects/${encodeURIComponent(schedule.projectId)}/reports?tab=${encodeURIComponent(schedule.reportType)}`,
  );

  let reportLines: string[];
  switch (schedule.reportType) {
    case 'lot-status':
      reportLines = await buildLotStatusLines(schedule.projectId);
      break;
    case 'ncr':
      reportLines = await buildNcrLines(schedule.projectId, now);
      break;
    case 'test':
      reportLines = await buildTestLines(schedule.projectId);
      break;
    case 'diary':
      reportLines = await buildDiaryLines(schedule.projectId);
      break;
  }

  return {
    reportTypeLabel,
    reportName,
    viewReportUrl,
    lines: [
      reportName,
      `Project: ${schedule.project.name}`,
      `Generated: ${now.toISOString()}`,
      '',
      ...reportLines,
      '',
      `View online: ${viewReportUrl}`,
    ],
  };
}

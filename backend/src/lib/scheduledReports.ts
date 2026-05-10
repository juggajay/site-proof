import { prisma } from './prisma.js';
import { sendScheduledReportEmail } from './email.js';
import { buildFrontendUrl } from './runtimeConfig.js';
import { logError, logInfo } from './serverLogger.js';

export const SCHEDULED_REPORT_TYPES = ['lot-status', 'ncr', 'test', 'diary'] as const;
export const SCHEDULED_REPORT_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const;
export const MAX_SCHEDULED_REPORTS_PER_PROJECT = 25;
export const MAX_SCHEDULED_REPORT_RECIPIENTS = 50;
export const MAX_SCHEDULED_REPORT_RECIPIENTS_INPUT_LENGTH = MAX_SCHEDULED_REPORT_RECIPIENTS * 260;

export type ScheduledReportType = (typeof SCHEDULED_REPORT_TYPES)[number];
export type ScheduledReportFrequency = (typeof SCHEDULED_REPORT_FREQUENCIES)[number];

const DEFAULT_PROCESS_LIMIT = 50;
const DEFAULT_LOCK_MS = 15 * 60 * 1000;
const DEFAULT_RETRY_DELAY_MS = 15 * 60 * 1000;
const DEFAULT_WORKER_INTERVAL_MS = 60 * 1000;
const PDF_PAGE_WIDTH = 595;
const PDF_PAGE_HEIGHT = 842;
const PDF_LEFT_MARGIN = 50;
const PDF_TOP_Y = 800;
const PDF_LINE_HEIGHT = 14;
const PDF_LINES_PER_PAGE = 52;
const PDF_MAX_CHARS_PER_LINE = 95;

const REPORT_TYPE_LABELS: Record<ScheduledReportType, string> = {
  'lot-status': 'Lot Status Report',
  ncr: 'NCR Report',
  test: 'Test Results Report',
  diary: 'Daily Diary Report',
};

type ScheduledReportForDelivery = {
  id: string;
  projectId: string;
  reportType: string;
  frequency: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  timeOfDay: string;
  recipients: string;
  project: {
    name: string;
  };
};

export type ScheduledReportDeliveryStatus = 'sent' | 'failed' | 'skipped';

export type ScheduledReportDeliveryResult = {
  scheduleId: string;
  projectId: string;
  reportType: string;
  recipients: number;
  status: ScheduledReportDeliveryStatus;
  nextRunAt?: string;
  error?: string;
};

export type ProcessDueScheduledReportsResult = {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  results: ScheduledReportDeliveryResult[];
};

export type ProcessDueScheduledReportsOptions = {
  now?: Date;
  limit?: number;
  lockMs?: number;
  retryDelayMs?: number;
  scheduleIds?: string[];
};

type ScheduledReportDocument = {
  reportTypeLabel: string;
  reportName: string;
  lines: string[];
  viewReportUrl: string;
};

function isScheduledReportType(value: string): value is ScheduledReportType {
  return SCHEDULED_REPORT_TYPES.includes(value as ScheduledReportType);
}

function isScheduledReportFrequency(value: string): value is ScheduledReportFrequency {
  return SCHEDULED_REPORT_FREQUENCIES.includes(value as ScheduledReportFrequency);
}

function parsePositiveInteger(value: unknown, fallback: number): number {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function dayCountInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function dateAtTime(base: Date, timeOfDay: string): Date {
  const [hours = 9, minutes = 0] = timeOfDay.split(':').map(Number);
  const date = new Date(base);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function monthlyDateAtTime(base: Date, dayOfMonth: number, timeOfDay: string): Date {
  const [hours = 9, minutes = 0] = timeOfDay.split(':').map(Number);
  const date = new Date(base);
  const clampedDay = Math.min(dayOfMonth, dayCountInMonth(date.getFullYear(), date.getMonth()));
  date.setDate(clampedDay);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function calculateNextScheduledReportRunAt(
  frequency: ScheduledReportFrequency,
  dayOfWeek: number | null,
  dayOfMonth: number | null,
  timeOfDay: string,
  from = new Date(),
): Date {
  switch (frequency) {
    case 'daily': {
      const nextRun = dateAtTime(from, timeOfDay);
      if (nextRun <= from) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      return nextRun;
    }

    case 'weekly': {
      const targetDay = dayOfWeek ?? 1;
      const nextRun = dateAtTime(from, timeOfDay);
      const currentDay = nextRun.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil < 0 || (daysUntil === 0 && nextRun <= from)) {
        daysUntil += 7;
      }
      nextRun.setDate(nextRun.getDate() + daysUntil);
      return nextRun;
    }

    case 'monthly': {
      const targetDay = dayOfMonth ?? 1;
      const nextRun = monthlyDateAtTime(from, targetDay, timeOfDay);
      if (nextRun > from) {
        return nextRun;
      }

      const nextMonth = new Date(from);
      nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
      return monthlyDateAtTime(nextMonth, targetDay, timeOfDay);
    }
  }
}

function parseRecipients(recipients: string): string[] {
  return Array.from(
    new Set(
      recipients
        .split(/[,;\n]/)
        .map((recipient) => recipient.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function validateScheduledReportRecipients(recipients: string[]): void {
  if (recipients.length === 0) {
    throw new Error('Scheduled report has no recipients');
  }

  if (recipients.length > MAX_SCHEDULED_REPORT_RECIPIENTS) {
    throw new Error(
      `Scheduled report cannot include more than ${MAX_SCHEDULED_REPORT_RECIPIENTS} recipients`,
    );
  }

  const invalidRecipient = recipients.find(
    (recipient) => recipient.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient),
  );
  if (invalidRecipient) {
    throw new Error('Scheduled report recipients must contain valid email addresses');
  }
}

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

async function buildScheduledReportDocument(
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

function normalizePdfText(value: string): string {
  const normalizedNewlines = value.split('\r\n').join('\n').split('\r').join('\n');
  let normalized = '';

  for (const character of normalizedNewlines) {
    const code = character.charCodeAt(0);
    const isAllowedControl = code === 9 || code === 10 || code === 13;
    const isPrintableAscii = code >= 32 && code <= 126;
    normalized += isAllowedControl || isPrintableAscii ? character : '?';
  }

  return normalized;
}

function escapePdfText(value: string): string {
  return normalizePdfText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapPdfLine(line: string): string[] {
  const normalizedLine = normalizePdfText(line);
  if (normalizedLine.length <= PDF_MAX_CHARS_PER_LINE) {
    return [normalizedLine];
  }

  const wrapped: string[] = [];
  let current = '';
  for (const word of normalizedLine.split(/\s+/)) {
    if (word.length > PDF_MAX_CHARS_PER_LINE) {
      if (current) {
        wrapped.push(current);
        current = '';
      }
      for (let index = 0; index < word.length; index += PDF_MAX_CHARS_PER_LINE) {
        wrapped.push(word.slice(index, index + PDF_MAX_CHARS_PER_LINE));
      }
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > PDF_MAX_CHARS_PER_LINE) {
      wrapped.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) {
    wrapped.push(current);
  }

  return wrapped.length > 0 ? wrapped : [''];
}

function createPdfContent(lines: string[]): string {
  const textLines = lines.map((line) => `(${escapePdfText(line)}) Tj\n0 -${PDF_LINE_HEIGHT} Td`);
  return `BT\n/F1 10 Tf\n${PDF_LEFT_MARGIN} ${PDF_TOP_Y} Td\n${textLines.join('\n')}\nET`;
}

function createTextPdf(lines: string[]): Buffer {
  const wrappedLines = lines.flatMap((line) => (line.length === 0 ? [''] : wrapPdfLine(line)));
  const pages: string[][] = [];
  for (let index = 0; index < wrappedLines.length; index += PDF_LINES_PER_PAGE) {
    pages.push(wrappedLines.slice(index, index + PDF_LINES_PER_PAGE));
  }
  if (pages.length === 0) {
    pages.push(['']);
  }

  const objects: string[] = ['', '', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const pageObjectNumbers: number[] = [];

  for (const pageLines of pages) {
    const content = createPdfContent(pageLines);
    const contentObjectNumber = objects.length;
    objects.push(
      `<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`,
    );

    const pageObjectNumber = objects.length;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`,
    );
    pageObjectNumbers.push(pageObjectNumber);
  }

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageObjectNumbers.map((page) => `${page} 0 R`).join(' ')}] /Count ${pageObjectNumbers.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let objectNumber = 1; objectNumber < objects.length; objectNumber += 1) {
    offsets[objectNumber] = Buffer.byteLength(pdf, 'utf8');
    pdf += `${objectNumber} 0 obj\n${objects[objectNumber]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let objectNumber = 1; objectNumber < objects.length; objectNumber += 1) {
    pdf += `${String(offsets[objectNumber]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}

async function claimScheduledReport(
  scheduleId: string,
  now: Date,
  lockMs: number,
): Promise<boolean> {
  const lockUntil = new Date(now.getTime() + lockMs);
  const claim = await prisma.scheduledReport.updateMany({
    where: {
      id: scheduleId,
      isActive: true,
      OR: [{ nextRunAt: { lte: now } }, { nextRunAt: null }],
    },
    data: {
      nextRunAt: lockUntil,
    },
  });

  return claim.count === 1;
}

async function retryScheduledReport(
  scheduleId: string,
  now: Date,
  retryDelayMs: number,
): Promise<Date> {
  const retryAt = new Date(now.getTime() + retryDelayMs);
  await prisma.scheduledReport.update({
    where: { id: scheduleId },
    data: { nextRunAt: retryAt },
  });
  return retryAt;
}

async function processScheduledReport(
  schedule: ScheduledReportForDelivery,
  now: Date,
  options: Required<Pick<ProcessDueScheduledReportsOptions, 'lockMs' | 'retryDelayMs'>>,
): Promise<ScheduledReportDeliveryResult> {
  const recipients = parseRecipients(schedule.recipients);
  const claimed = await claimScheduledReport(schedule.id, now, options.lockMs);
  if (!claimed) {
    return {
      scheduleId: schedule.id,
      projectId: schedule.projectId,
      reportType: schedule.reportType,
      recipients: recipients.length,
      status: 'skipped',
      error: 'Schedule was already claimed or is no longer due',
    };
  }

  try {
    if (!isScheduledReportFrequency(schedule.frequency)) {
      throw new Error(`Unsupported scheduled report frequency: ${schedule.frequency}`);
    }
    validateScheduledReportRecipients(recipients);

    const document = await buildScheduledReportDocument(schedule, now);
    const pdfBuffer = createTextPdf(document.lines);
    const nextRunAt = calculateNextScheduledReportRunAt(
      schedule.frequency,
      schedule.dayOfWeek,
      schedule.dayOfMonth,
      schedule.timeOfDay,
      now,
    );

    const emailResult = await sendScheduledReportEmail({
      to: recipients,
      projectName: schedule.project.name,
      reportType: document.reportTypeLabel,
      reportName: document.reportName,
      generatedAt: now.toISOString(),
      pdfBuffer,
      viewReportUrl: document.viewReportUrl,
    });

    if (!emailResult.success) {
      throw new Error(emailResult.error || 'Scheduled report email failed');
    }

    await prisma.scheduledReport.update({
      where: { id: schedule.id },
      data: {
        lastSentAt: now,
        nextRunAt,
      },
    });

    return {
      scheduleId: schedule.id,
      projectId: schedule.projectId,
      reportType: schedule.reportType,
      recipients: recipients.length,
      status: 'sent',
      nextRunAt: nextRunAt.toISOString(),
    };
  } catch (error) {
    const retryAt = await retryScheduledReport(schedule.id, now, options.retryDelayMs);
    return {
      scheduleId: schedule.id,
      projectId: schedule.projectId,
      reportType: schedule.reportType,
      recipients: recipients.length,
      status: 'failed',
      nextRunAt: retryAt.toISOString(),
      error: error instanceof Error ? error.message : 'Unknown scheduled report error',
    };
  }
}

export async function processDueScheduledReports(
  options: ProcessDueScheduledReportsOptions = {},
): Promise<ProcessDueScheduledReportsResult> {
  if (options.scheduleIds && options.scheduleIds.length === 0) {
    return { processed: 0, sent: 0, failed: 0, skipped: 0, results: [] };
  }

  const now = options.now ?? new Date();
  const limit = parsePositiveInteger(options.limit, DEFAULT_PROCESS_LIMIT);
  const lockMs = parsePositiveInteger(options.lockMs, DEFAULT_LOCK_MS);
  const retryDelayMs = parsePositiveInteger(options.retryDelayMs, DEFAULT_RETRY_DELAY_MS);
  const schedules = await prisma.scheduledReport.findMany({
    where: {
      isActive: true,
      ...(options.scheduleIds ? { id: { in: options.scheduleIds } } : {}),
      OR: [{ nextRunAt: { lte: now } }, { nextRunAt: null }],
    },
    include: {
      project: {
        select: { name: true },
      },
    },
    orderBy: [{ nextRunAt: 'asc' }, { createdAt: 'asc' }],
    take: limit,
  });

  const results: ScheduledReportDeliveryResult[] = [];
  for (const schedule of schedules) {
    results.push(await processScheduledReport(schedule, now, { lockMs, retryDelayMs }));
  }

  const sent = results.filter((result) => result.status === 'sent').length;
  const failed = results.filter((result) => result.status === 'failed').length;
  const skipped = results.filter((result) => result.status === 'skipped').length;

  return {
    processed: results.length,
    sent,
    failed,
    skipped,
    results,
  };
}

function getScheduledReportWorkerEnabled(): boolean {
  const configured = process.env.SCHEDULED_REPORT_WORKER_ENABLED?.trim().toLowerCase();
  if (configured === 'false' || configured === '0' || configured === 'no') {
    return false;
  }
  if (configured === 'true' || configured === '1' || configured === 'yes') {
    return true;
  }

  return process.env.NODE_ENV === 'production';
}

function getScheduledReportWorkerIntervalMs(): number {
  return parsePositiveInteger(
    process.env.SCHEDULED_REPORT_WORKER_INTERVAL_MS,
    DEFAULT_WORKER_INTERVAL_MS,
  );
}

export function startScheduledReportWorker(): { stop: () => void } | null {
  if (!getScheduledReportWorkerEnabled()) {
    return null;
  }

  const intervalMs = getScheduledReportWorkerIntervalMs();
  let isRunning = false;

  const run = async () => {
    if (isRunning) {
      return;
    }

    isRunning = true;
    try {
      const result = await processDueScheduledReports();
      if (result.processed > 0) {
        logInfo('[Scheduled Reports] Processed due schedules', {
          processed: result.processed,
          sent: result.sent,
          failed: result.failed,
          skipped: result.skipped,
        });
      }
      for (const failedResult of result.results.filter((item) => item.status === 'failed')) {
        logError('[Scheduled Reports] Delivery failed', failedResult);
      }
    } catch (error) {
      logError('[Scheduled Reports] Worker run failed', error);
    } finally {
      isRunning = false;
    }
  };

  const initialTimer = setTimeout(
    () => {
      void run();
    },
    Math.min(5000, intervalMs),
  );
  const intervalTimer = setInterval(() => {
    void run();
  }, intervalMs);

  logInfo('[Scheduled Reports] Worker started', { intervalMs });

  return {
    stop: () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
      logInfo('[Scheduled Reports] Worker stopped');
    },
  };
}

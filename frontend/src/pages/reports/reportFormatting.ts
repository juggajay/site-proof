import type { DateFormat } from '@/lib/dateFormat';

function formatDatePart(day: string, month: string, year: string, dateFormat: DateFormat): string {
  switch (dateFormat) {
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'DD/MM/YYYY':
    default:
      return `${day}/${month}/${year}`;
  }
}

function readPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? '';
}

export function formatReportDateTime(
  dateValue: Date | string,
  dateFormat: DateFormat,
  timezone: string,
): string {
  const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

  try {
    const parts = new Intl.DateTimeFormat('en-AU', {
      timeZone: timezone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).formatToParts(date);

    const day = readPart(parts, 'day');
    const month = readPart(parts, 'month');
    const year = readPart(parts, 'year');
    const hour = readPart(parts, 'hour');
    const minute = readPart(parts, 'minute');
    const second = readPart(parts, 'second');
    const dayPeriod = readPart(parts, 'dayPeriod').toUpperCase();

    return `${formatDatePart(day, month, year, dateFormat)}, ${hour}:${minute}:${second} ${dayPeriod}`;
  } catch {
    return date.toLocaleString('en-AU');
  }
}

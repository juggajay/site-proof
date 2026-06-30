export const REPORT_DATE_RANGE_ERROR = 'Start date must be on or before end date.';

export function getReportDateRangeError(startDate: string, endDate: string): string | null {
  if (!startDate || !endDate) return null;
  return startDate > endDate ? REPORT_DATE_RANGE_ERROR : null;
}

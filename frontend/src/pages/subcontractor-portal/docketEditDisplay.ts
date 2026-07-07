// ===== Display formatters =====
// Pure presentation helpers shared between DocketEditPage and DocketEditTabs.
// Currency now delegates to the single lib/formatAud implementation (cents) so
// the subbie docket surfaces match the office approvals view instead of rounding
// to whole dollars.
import { formatAud } from '@/lib/formatAud';

export const formatCurrency = formatAud;

export function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

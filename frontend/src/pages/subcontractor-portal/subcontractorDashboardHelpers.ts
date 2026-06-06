// ===== Subcontractor dashboard helpers =====
// Pure formatting/status/attention-item logic moved verbatim out of
// SubcontractorDashboard. TanStack Query usage, portal access checks, refresh
// behavior, route links, and page layout stay in the page; JSX (status icons,
// the badge wrapper) also stays in the page and renders from this metadata.
import { formatDateKey } from '@/lib/localDate';

export function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// The `now` parameter exists only so tests can pin the cutoffs; the page calls
// this with no argument, exactly as before.
export function getGreeting(now: Date = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function getToday() {
  return formatDateKey();
}

export interface DocketStatusMeta {
  label: string;
  className: string;
}

const DOCKET_STATUS_CLASSES: Record<string, string> = {
  draft: 'bg-muted text-foreground',
  pending_approval: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
  queried: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
};

const DOCKET_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  queried: 'Queried',
};

// Unknown statuses keep the original fallbacks: the raw status as the label
// and the draft styling for the badge class.
export function getDocketStatusMeta(status: string): DocketStatusMeta {
  return {
    label: DOCKET_STATUS_LABELS[status] || status,
    className: DOCKET_STATUS_CLASSES[status] || DOCKET_STATUS_CLASSES.draft,
  };
}

// Structural inputs — the page's Docket/Notification query contracts satisfy
// these without casts.
export interface AttentionDocket {
  id: string;
  date: string;
  status: string;
  foremanNotes?: string;
}

export interface AttentionNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface NeedsAttentionItem {
  id: string;
  type: string;
  title: string;
  message: string;
  date: string;
  link: string;
}

// `myCompanyLink` is passed in because the page builds it with the current
// project query string (`/my-company?projectId=...` when switched); the
// rate-counter items must keep linking to exactly that URL.
export function buildNeedsAttentionItems({
  recentDockets,
  notifications,
  myCompanyLink,
}: {
  recentDockets: AttentionDocket[];
  notifications: AttentionNotification[];
  myCompanyLink: string;
}): NeedsAttentionItem[] {
  return [
    // Queried dockets
    ...recentDockets
      .filter((d) => d.status === 'queried')
      .map((d) => ({
        id: d.id,
        type: 'docket_queried',
        title: 'Docket Queried',
        message: d.foremanNotes || 'Please review and respond',
        date: d.date,
        link: `/subcontractor-portal/docket/${d.id}`,
      })),
    // Rejected dockets
    ...recentDockets
      .filter((d) => d.status === 'rejected')
      .map((d) => ({
        id: d.id,
        type: 'docket_rejected',
        title: 'Docket Rejected',
        message: d.foremanNotes || 'Please review and resubmit',
        date: d.date,
        link: `/subcontractor-portal/docket/${d.id}`,
      })),
    // Rate counter-proposals from notifications
    ...notifications
      .filter((n) => n.type === 'rate_counter' && !n.isRead)
      .map((n) => ({
        id: n.id,
        type: 'rate_counter',
        title: n.title,
        message: n.message,
        date: n.createdAt,
        link: myCompanyLink,
      })),
  ];
}

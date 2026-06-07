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

// Shared plain-language warning for when the HC has turned off the subbie's
// "Assigned Work" (lots) portal module. Labour docket lines must be allocated to
// a lot, and the backend enforces the lots module on `GET /api/lots` (403) and
// on the labour submit guard (LOT_REQUIRED), so without it labour dockets are a
// dead-end. Plant-only dockets still work. Both the dashboard and the docket
// editor render this exact copy so the subbie hears the same explanation
// wherever they hit the wall.
export const LOTS_MODULE_DISABLED_DOCKET_MESSAGE =
  'Your head contractor has not enabled Assigned Work (lot) access, which is required to submit labour dockets. Plant-only dockets still work. Ask them to enable it.';

export interface DocketPrerequisiteState {
  // At least one approved employee or plant item (i.e. something can be added).
  hasDocketResources: boolean;
  // Lots module on, but no lot assigned yet — labour can't be allocated.
  needsLotAssignment: boolean;
  // Lots module off — labour is blocked entirely, only plant dockets work.
  lotsModuleDisabled: boolean;
  // True only when the subbie can actually start a normal docket. When the lots
  // module is off this stays false so the dashboard surfaces the warning instead
  // of silently claiming the subbie is ready.
  prerequisitesMet: boolean;
}

// Centralizes the dashboard's "can this subbie start a docket?" decision so the
// lots-module-off case is handled honestly. Previously a disabled lots module
// made `needsLotAssignment` false (lots check skipped), which made the page
// claim the subbie was ready even though labour dockets are impossible without
// lot access.
export function getDocketPrerequisiteState({
  approvedEmployeeCount,
  approvedPlantCount,
  lotsModuleEnabled,
  assignedLotCount,
}: {
  approvedEmployeeCount: number;
  approvedPlantCount: number;
  lotsModuleEnabled: boolean;
  assignedLotCount: number;
}): DocketPrerequisiteState {
  const hasDocketResources = approvedEmployeeCount > 0 || approvedPlantCount > 0;
  const lotsModuleDisabled = !lotsModuleEnabled;
  const needsLotAssignment = lotsModuleEnabled && assignedLotCount === 0;
  const prerequisitesMet = hasDocketResources && !needsLotAssignment && !lotsModuleDisabled;

  return { hasDocketResources, needsLotAssignment, lotsModuleDisabled, prerequisitesMet };
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

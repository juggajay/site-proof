import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

/**
 * Basic skeleton pulse animation element
 */
export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />;
}

/**
 * Skeleton for a table row
 */
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b border-border">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

/**
 * Skeleton for a card element
 */
export function CardSkeleton() {
  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
    </div>
  );
}

/**
 * Skeleton for a list item
 */
export function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-border">
      <Skeleton className="h-8 w-8 rounded" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  );
}

/**
 * Skeleton for the lots table
 */
export function LotsTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header skeleton */}
      <div className="bg-muted px-4 py-3 border-b border-border">
        <div className="flex gap-4">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      {/* Row skeletons */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3 border-b border-border last:border-b-0">
          <div className="flex gap-4 items-center">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for the projects grid
 */
export function ProjectsGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-8 w-20 rounded" />
            <Skeleton className="h-8 w-20 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for dashboard stats cards
 */
export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-12" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Full page loading skeleton
 */
export function PageSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
        </div>
      </div>

      {/* Stats skeleton */}
      <StatCardsSkeleton />

      {/* Content skeleton */}
      <LotsTableSkeleton />
    </div>
  );
}

/**
 * Skeleton matched to DiaryTimelineEntry layout:
 * icon (w-10 h-10 rounded-full) + text column (label+time row, description line).
 * Same outer padding/border as the real entry so content landing causes no layout shift.
 */
export function DiaryTimelineEntrySkeleton() {
  return (
    <div
      className="flex gap-3 p-3 rounded-lg border bg-card animate-pulse"
      data-testid="diary-timeline-entry-skeleton"
    >
      {/* icon circle */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted" />
      <div className="flex-1 min-w-0 space-y-2">
        {/* label + time badges row */}
        <div className="flex items-center gap-2">
          <div className="h-3 w-14 bg-muted rounded" />
          <div className="h-3 w-10 bg-muted rounded" />
        </div>
        {/* description line */}
        <div className="h-4 w-3/4 bg-muted rounded" />
      </div>
    </div>
  );
}

/**
 * Skeleton matched to the DocketCard layout:
 * header row (subcontractor name + status badge) + 3-column grid (Date / Labour / Plant).
 * Same outer padding/border as the real card so content landing causes no layout shift.
 */
export function DocketCardSkeleton() {
  return (
    <div
      className="bg-card border rounded-xl p-4 space-y-3 animate-pulse"
      data-testid="docket-card-skeleton"
    >
      {/* Header: name + status badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1.5">
          <div className="h-5 w-36 bg-muted rounded" />
          <div className="h-4 w-24 bg-muted rounded" />
        </div>
        <div className="h-6 w-16 bg-muted rounded-full" />
      </div>
      {/* 3-column grid matching Date / Labour / Plant */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <div className="h-3 w-8 bg-muted rounded" />
          <div className="h-4 w-20 bg-muted rounded" />
        </div>
        <div className="space-y-1">
          <div className="h-3 w-12 bg-muted rounded" />
          <div className="h-4 w-10 bg-muted rounded" />
        </div>
        <div className="space-y-1">
          <div className="h-3 w-8 bg-muted rounded" />
          <div className="h-4 w-10 bg-muted rounded" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton matched to the WorklistItemCard layout:
 * icon circle (w-10 h-10) + text column (title + subtitle + lot) + chevron.
 * min-h-[72px] mirrors the real card's touch target size.
 */
export function WorklistItemSkeleton() {
  return (
    <div
      className="w-full flex items-center gap-3 p-4 rounded-lg border min-h-[72px] bg-card animate-pulse"
      data-testid="worklist-item-skeleton"
    >
      {/* icon circle */}
      <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0" />
      {/* text column */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-4 w-2/3 bg-muted rounded" />
        <div className="h-3 w-1/2 bg-muted rounded" />
      </div>
      {/* chevron placeholder */}
      <div className="h-5 w-5 bg-muted rounded flex-shrink-0" />
    </div>
  );
}

/**
 * Skeleton matched to the LotMobileList card layout:
 * lot number header + description + tags row + footer row (ITPs/Tests + date).
 * border-l-4 mirrors the status accent on real mobile cards.
 */
export function LotMobileCardSkeleton() {
  return (
    <div
      className="rounded-lg border bg-card p-4 border-l-4 border-l-border animate-pulse"
      data-testid="lot-mobile-card-skeleton"
    >
      {/* header: lot number + status badge */}
      <div className="flex items-start justify-between mb-2">
        <div className="h-6 w-24 bg-muted rounded" />
        <div className="h-5 w-20 bg-muted rounded" />
      </div>
      {/* description */}
      <div className="h-4 w-full bg-muted rounded mb-1" />
      <div className="h-4 w-3/4 bg-muted rounded mb-3" />
      {/* tags row */}
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="h-5 w-20 bg-muted rounded" />
        <div className="h-5 w-24 bg-muted rounded" />
      </div>
      {/* footer */}
      <div className="flex items-center justify-between pt-3 border-t">
        <div className="flex gap-3">
          <div className="h-3 w-12 bg-muted rounded" />
          <div className="h-3 w-12 bg-muted rounded" />
        </div>
        <div className="h-3 w-20 bg-muted rounded" />
      </div>
    </div>
  );
}

export default Skeleton;

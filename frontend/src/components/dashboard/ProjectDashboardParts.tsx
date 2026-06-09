import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, Calendar, Clock, FileCheck, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatRelativeTime,
  getActivityFallbackRoute,
  getSafeProjectLink,
  type ProjectDashboardData,
} from './ProjectDashboardHelpers';

export function StatPill({
  label,
  value,
  sub,
  icon,
  color,
  alert,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: ReactNode;
  color: string;
  alert?: boolean;
}) {
  const labelText = label.trim();

  return (
    <div
      className={cn(
        'bg-card px-3 py-2.5 text-center',
        alert && 'ring-1 ring-inset ring-destructive/30',
      )}
    >
      <div className={cn('flex items-center justify-center mb-1', color)}>{icon}</div>
      <p className={cn('text-lg font-bold leading-tight', alert && 'text-destructive')}>
        <span>{value}</span>
        {labelText && <span className="ml-1 text-sm font-semibold"> {labelText}</span>}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{sub}</p>}
    </div>
  );
}

export function StatusCount({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-center gap-1.5 mb-0.5">
        <div className={cn('w-2 h-2 rounded-full', color)} />
        <span className="text-lg font-semibold">{count}</span>
      </div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

export function NCRCategoryBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs w-20 text-muted-foreground">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium w-6 text-right">{count}</span>
    </div>
  );
}

export function ActivityIcon({ type }: { type: string }) {
  // Quiet Authority: activity-type icons are category markers, not status
  // decisions — render them monochrome (mono icon, neutral tint).
  const base = 'h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground';
  switch (type) {
    case 'ncr':
      return <AlertTriangle className={base} />;
    case 'lot':
      return <MapPin className={base} />;
    case 'holdpoint':
      return <Clock className={base} />;
    case 'docket':
      return <FileCheck className={base} />;
    case 'diary':
      return <Calendar className={base} />;
    default:
      return <Activity className={base} />;
  }
}

export function ActivityContent({
  activity,
}: {
  activity: ProjectDashboardData['recentActivity'][number];
}) {
  return (
    <>
      <ActivityIcon type={activity.type} />
      <div className="min-w-0 flex-1">
        <p className="text-sm truncate">{activity.description}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatRelativeTime(activity.timestamp)}
        </p>
      </div>
    </>
  );
}

export function ActivityRow({
  activity,
  projectRouteBase,
}: {
  activity: ProjectDashboardData['recentActivity'][number];
  projectRouteBase: string;
}) {
  if (!activity.link) {
    return (
      <div className="flex items-start gap-3 p-3">
        <ActivityContent activity={activity} />
      </div>
    );
  }

  return (
    <Link
      to={getSafeProjectLink(
        activity.link,
        projectRouteBase,
        getActivityFallbackRoute(activity.type, projectRouteBase),
      )}
      className="flex items-start gap-3 p-3"
    >
      <ActivityContent activity={activity} />
    </Link>
  );
}

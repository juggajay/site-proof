import { Activity } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

export interface DashboardRecentActivity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  link?: string;
}

interface RecentActivityWidgetProps {
  activities: DashboardRecentActivity[];
}

function formatActivityTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }
  return formatDateTime(date);
}

export function RecentActivityWidget({ activities }: RecentActivityWidgetProps) {
  return (
    <div className="bg-card rounded-lg border">
      <div className="flex items-center gap-2 border-b p-4">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Recent Activity</h2>
      </div>
      <div className="divide-y">
        {activities.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">No recent activity</div>
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <p className="text-sm leading-relaxed text-foreground">{activity.description}</p>
              <p className="mt-0.5 flex-shrink-0 whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">
                {formatActivityTimestamp(activity.timestamp)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

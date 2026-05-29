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
      <div className="p-4 border-b flex items-center gap-2">
        <Activity className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Recent Activity</h2>
      </div>
      <div className="divide-y">
        {activities.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">No recent activity</div>
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="p-4">
              <p className="text-sm">{activity.description}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatActivityTimestamp(activity.timestamp)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

import { Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
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

function getSafeActivityLink(link: string | undefined): string | null {
  const trimmed = link?.trim();
  if (!trimmed || !trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return null;
  }
  return trimmed;
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
          activities.map((activity) => {
            const activityLink = getSafeActivityLink(activity.link);

            return (
              <div key={activity.id} className="flex items-start justify-between gap-3 px-4 py-3">
                {activityLink ? (
                  <Link
                    to={activityLink}
                    className="text-sm leading-relaxed text-foreground hover:text-primary hover:underline"
                  >
                    {activity.description}
                  </Link>
                ) : (
                  <p className="text-sm leading-relaxed text-foreground">{activity.description}</p>
                )}
                <p className="mt-0.5 flex-shrink-0 whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">
                  {formatActivityTimestamp(activity.timestamp)}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

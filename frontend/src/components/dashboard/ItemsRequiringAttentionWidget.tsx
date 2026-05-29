import { AlertCircle, AlertTriangle, ChevronRight, Clock } from 'lucide-react';

export interface AttentionItem {
  id: string;
  type: 'ncr' | 'holdpoint';
  title: string;
  description: string;
  status: string;
  daysOverdue?: number;
  daysStale?: number;
  dueDate?: string;
  project: {
    id: string;
    name: string;
    projectNumber: string;
  };
  link: string;
}

export interface DashboardAttentionItems {
  overdueNCRs: AttentionItem[];
  staleHoldPoints: AttentionItem[];
  total: number;
}

interface ItemsRequiringAttentionWidgetProps {
  attentionItems: DashboardAttentionItems;
  onNavigate: (to: string) => void;
}

function getSafeInternalLink(link: string | undefined, fallback: string): string {
  if (link?.startsWith('/') && !link.startsWith('//')) {
    return link;
  }
  return fallback;
}

export function ItemsRequiringAttentionWidget({
  attentionItems,
  onNavigate,
}: ItemsRequiringAttentionWidgetProps) {
  if (attentionItems.total === 0) {
    return null;
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg">
      <div className="p-4 border-b border-red-200 flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-red-500" />
        <h2 className="text-lg font-semibold text-red-700">Items Requiring Attention</h2>
        <span className="ml-auto bg-red-100 text-red-700 text-sm font-medium px-2.5 py-0.5 rounded-full">
          {attentionItems.total}
        </span>
      </div>
      <div className="divide-y divide-red-100">
        {/* Overdue NCRs */}
        {attentionItems.overdueNCRs.length > 0 && (
          <div className="p-4">
            <h3 className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Overdue NCRs ({attentionItems.overdueNCRs.length})
            </h3>
            <div className="space-y-2">
              {attentionItems.overdueNCRs.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onNavigate(getSafeInternalLink(item.link, '/projects'))}
                  className="w-full flex items-center justify-between p-3 bg-white rounded-lg border border-red-100 hover:border-red-300 hover:bg-red-50 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{item.title}</span>
                      <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">
                        {item.daysOverdue} day{item.daysOverdue !== 1 ? 's' : ''} overdue
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {item.project.name} • {item.description}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Stale Hold Points */}
        {attentionItems.staleHoldPoints.length > 0 && (
          <div className="p-4">
            <h3 className="text-sm font-semibold text-amber-600 mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Stale Hold Points ({attentionItems.staleHoldPoints.length})
            </h3>
            <div className="space-y-2">
              {attentionItems.staleHoldPoints.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onNavigate(getSafeInternalLink(item.link, '/projects'))}
                  className="w-full flex items-center justify-between p-3 bg-white rounded-lg border border-amber-100 hover:border-amber-300 hover:bg-amber-50 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{item.title}</span>
                      <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">
                        {item.daysStale} day{item.daysStale !== 1 ? 's' : ''} waiting
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {item.project.name} • {item.description}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

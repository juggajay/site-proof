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
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b p-4">
        <AlertCircle className="h-4 w-4 text-destructive" />
        <h2 className="text-sm font-semibold text-foreground">Items Requiring Attention</h2>
        <span className="ml-auto rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-destructive">
          {attentionItems.total}
        </span>
      </div>
      <div className="divide-y">
        {/* Overdue NCRs */}
        {attentionItems.overdueNCRs.length > 0 && (
          <div className="p-4">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Overdue NCRs ({attentionItems.overdueNCRs.length})
            </h3>
            <div className="space-y-px">
              {attentionItems.overdueNCRs.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onNavigate(getSafeInternalLink(item.link, '/projects'))}
                  className="flex w-full items-center justify-between gap-3 rounded-md border border-transparent p-3 text-left transition-colors hover:border-border hover:bg-muted"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span
                      className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-destructive"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-foreground">
                          {item.title}
                        </span>
                        <span className="font-mono text-xs font-medium tabular-nums text-destructive">
                          {item.daysOverdue} day{item.daysOverdue !== 1 ? 's' : ''} overdue
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {item.project.name} • {item.description}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Stale Hold Points */}
        {attentionItems.staleHoldPoints.length > 0 && (
          <div className="p-4">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Clock className="h-4 w-4 text-warning" />
              Stale Hold Points ({attentionItems.staleHoldPoints.length})
            </h3>
            <div className="space-y-px">
              {attentionItems.staleHoldPoints.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onNavigate(getSafeInternalLink(item.link, '/projects'))}
                  className="flex w-full items-center justify-between gap-3 rounded-md border border-transparent p-3 text-left transition-colors hover:border-border hover:bg-muted"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span
                      className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-warning"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-foreground">
                          {item.title}
                        </span>
                        <span className="font-mono text-xs font-medium tabular-nums text-warning">
                          {item.daysStale} day{item.daysStale !== 1 ? 's' : ''} waiting
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {item.project.name} • {item.description}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

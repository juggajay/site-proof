import { AlertCircle, ChevronRight } from 'lucide-react';

import type { PMDashboardData } from './ProjectManagerDashboardHelpers';

type PMAttentionItem = PMDashboardData['attentionItems'][number];

interface ProjectManagerAttentionItemsProps {
  items: PMAttentionItem[];
  onOpenItem: (link: string) => void;
}

function getUrgencyClass(urgency: PMAttentionItem['urgency']) {
  if (urgency === 'critical') {
    return 'border border-destructive/30 bg-destructive/10 text-destructive';
  }

  if (urgency === 'warning') {
    return 'border border-warning/30 bg-warning/10 text-warning';
  }

  return 'border border-info/30 bg-info/10 text-info';
}

export function ProjectManagerAttentionItems({
  items,
  onOpenItem,
}: ProjectManagerAttentionItemsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="bg-card border rounded-lg">
      <div className="p-4 border-b flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-destructive" />
        <h2 className="text-lg font-semibold text-foreground">Items Requiring Attention</h2>
        <span className="ml-auto rounded-full border border-destructive/30 bg-destructive/10 text-destructive text-sm font-medium px-2.5 py-0.5">
          {items.length}
        </span>
      </div>
      <div className="divide-y">
        {items.slice(0, 5).map((item) => (
          <button
            key={item.id}
            onClick={() => onOpenItem(item.link)}
            className="w-full flex items-center justify-between p-3 hover:bg-muted transition-colors text-left"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs ${getUrgencyClass(item.urgency)}`}>
                  {item.type.toUpperCase()}
                </span>
                <span className="font-medium text-sm">{item.title}</span>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-1">{item.description}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

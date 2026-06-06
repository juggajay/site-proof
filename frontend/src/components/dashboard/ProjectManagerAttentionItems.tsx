import { AlertCircle, ChevronRight } from 'lucide-react';

import type { PMDashboardData } from './ProjectManagerDashboardHelpers';

type PMAttentionItem = PMDashboardData['attentionItems'][number];

interface ProjectManagerAttentionItemsProps {
  items: PMAttentionItem[];
  onOpenItem: (link: string) => void;
}

function getUrgencyClass(urgency: PMAttentionItem['urgency']) {
  if (urgency === 'critical') {
    return 'bg-red-100 text-red-700';
  }

  if (urgency === 'warning') {
    return 'bg-yellow-100 text-yellow-700';
  }

  return 'bg-blue-100 text-blue-700';
}

export function ProjectManagerAttentionItems({
  items,
  onOpenItem,
}: ProjectManagerAttentionItemsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg">
      <div className="p-4 border-b border-red-200 flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-red-500" />
        <h2 className="text-lg font-semibold text-red-700">Items Requiring Attention</h2>
        <span className="ml-auto bg-red-100 text-red-700 text-sm font-medium px-2.5 py-0.5 rounded-full">
          {items.length}
        </span>
      </div>
      <div className="divide-y divide-red-100">
        {items.slice(0, 5).map((item) => (
          <button
            key={item.id}
            onClick={() => onOpenItem(item.link)}
            className="w-full flex items-center justify-between p-3 hover:bg-red-100/50 transition-colors text-left"
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

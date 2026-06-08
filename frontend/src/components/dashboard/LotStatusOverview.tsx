import { ListChecks } from 'lucide-react';
import {
  EMPTY_LOT_STATUS_COUNTS,
  LOT_STATUS_OVERVIEW_ITEMS,
  type LotStatusCounts,
  type LotStatusKey,
} from '@/lib/lotStatusOverview';

interface LotStatusOverviewProps {
  counts?: Partial<LotStatusCounts>;
  onStatusClick: (status: LotStatusKey) => void;
}

function getLotStatusCount(
  counts: Partial<LotStatusCounts> | undefined,
  status: LotStatusKey,
): number {
  return counts?.[status] ?? EMPTY_LOT_STATUS_COUNTS[status];
}

export function LotStatusOverview({ counts, onStatusClick }: LotStatusOverviewProps) {
  return (
    <div className="bg-card rounded-lg border">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Lot Status Overview</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Completed means the work is done. Conformed means quality evidence is approved. Claimed
          means it is in a progress claim.
        </p>
      </div>
      <div className="divide-y">
        {LOT_STATUS_OVERVIEW_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => onStatusClick(item.key)}
            className="group w-full px-4 py-2.5 text-left transition-colors hover:bg-muted"
            title={item.description}
            type="button"
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${item.dotClassName}`}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                  <span className="font-mono text-sm font-medium tabular-nums text-foreground">
                    {getLotStatusCount(counts, item.key)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

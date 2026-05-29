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
          <ListChecks className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Lot Status Overview</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Completed means the work is done. Conformed means quality evidence is approved. Claimed
          means it is in a progress claim.
        </p>
      </div>
      <div className="p-4 space-y-1">
        {LOT_STATUS_OVERVIEW_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => onStatusClick(item.key)}
            className="w-full rounded p-2 text-left hover:bg-muted transition-colors"
            title={item.description}
            type="button"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2">
                <div className={`mt-1.5 h-3 w-3 flex-shrink-0 rounded-full ${item.dotClassName}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{item.label}</span>
                    <span className="font-medium">{getLotStatusCount(counts, item.key)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

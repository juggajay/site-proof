import type { Lot } from '../types'

export interface LotSummaryCardsProps {
  lot: Lot
}

export function LotSummaryCards({ lot }: LotSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="rounded-lg border p-4">
        <span className="text-sm text-muted-foreground">Chainage</span>
        <p className="font-medium text-lg">
          {lot.chainageStart != null && lot.chainageEnd != null
            ? `${lot.chainageStart} - ${lot.chainageEnd}`
            : lot.chainageStart ?? lot.chainageEnd ?? '—'}
        </p>
      </div>
      <div className="rounded-lg border p-4">
        <span className="text-sm text-muted-foreground">Activity Type</span>
        <p className="font-medium text-lg capitalize">{lot.activityType || '—'}</p>
      </div>
      <div className="rounded-lg border p-4">
        <span className="text-sm text-muted-foreground">Layer</span>
        <p className="font-medium text-lg">{lot.layer || '—'}</p>
      </div>
      <div className="rounded-lg border p-4">
        <span className="text-sm text-muted-foreground">Area/Zone</span>
        <p className="font-medium text-lg">{lot.areaZone || '—'}</p>
      </div>
    </div>
  )
}

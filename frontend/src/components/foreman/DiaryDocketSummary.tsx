import { useState } from 'react'
import { Users, Wrench, ChevronDown, ChevronUp, Clock, Check, Loader2 } from 'lucide-react'

interface DocketSummaryData {
  approvedDockets: Array<{
    id: string
    subcontractor: string
    workerCount: number
    totalLabourHours: number
    machineCount: number
    totalPlantHours: number
    workers: Array<{ name: string; role: string | null; hours: number }>
    machines: Array<{ type: string; description: string | null; idRego: string | null; hours: number }>
  }>
  pendingCount: number
  pendingDockets: Array<{ id: string; subcontractor: string }>
  totals: {
    workers: number
    labourHours: number
    machines: number
    plantHours: number
  }
}

interface ManualEntries {
  personnel: Array<{ id: string; name: string; hours?: number }>
  plant: Array<{ id: string; description: string; hoursOperated?: number }>
}

interface DiaryDocketSummaryProps {
  summary: DocketSummaryData | null
  manualEntries: ManualEntries
  loading: boolean
  onTapPending: (docketId: string) => void
  onAddManual: () => void
}

export function DiaryDocketSummary({
  summary, manualEntries, loading, onTapPending, onAddManual
}: DiaryDocketSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-muted rounded-lg">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading docket data...</span>
      </div>
    )
  }

  const hasDockets = summary && (summary.approvedDockets.length > 0 || summary.pendingCount > 0)
  const hasManual = manualEntries.personnel.length > 0 || manualEntries.plant.length > 0

  if (!hasDockets && !hasManual) {
    return (
      <div className="flex items-center justify-between px-4 py-3 bg-muted/50 rounded-lg border border-dashed">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">No dockets yet today</span>
        </div>
        <button
          onClick={onAddManual}
          className="text-sm text-primary font-medium touch-manipulation min-h-[32px]"
        >
          Add manually
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 touch-manipulation min-h-[48px]"
      >
        <div className="flex items-center gap-4 text-sm">
          {summary && summary.totals.workers > 0 && (
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4 text-emerald-600" />
              <strong>{summary.totals.workers}</strong> workers
            </span>
          )}
          {summary && summary.totals.machines > 0 && (
            <span className="flex items-center gap-1">
              <Wrench className="h-4 w-4 text-gray-600" />
              <strong>{summary.totals.machines}</strong> machines
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {summary && summary.pendingCount > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              {summary.pendingCount} pending
            </span>
          )}
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t px-4 py-3 space-y-3">
          {summary?.approvedDockets.map(d => (
            <div key={d.id} className="space-y-1">
              <div className="flex items-center gap-2">
                <Check className="h-3 w-3 text-green-600" />
                <span className="text-sm font-medium">{d.subcontractor}</span>
              </div>
              <p className="text-xs text-muted-foreground ml-5">
                {d.workerCount} workers &middot; {d.totalLabourHours}hrs
                {d.machineCount > 0 && <> &middot; {d.machineCount} machines &middot; {d.totalPlantHours}hrs</>}
              </p>
            </div>
          ))}

          {summary?.pendingDockets.map(d => (
            <button
              key={d.id}
              onClick={() => onTapPending(d.id)}
              className="flex items-center gap-2 w-full text-left touch-manipulation"
            >
              <Clock className="h-3 w-3 text-amber-500" />
              <span className="text-sm text-amber-600">{d.subcontractor} — pending</span>
            </button>
          ))}

          {summary && (
            <div className="border-t pt-2 text-xs text-muted-foreground">
              Totals: {summary.totals.workers} workers &middot; {summary.totals.labourHours}hrs
              {summary.totals.machines > 0 && <> &middot; {summary.totals.machines} machines &middot; {summary.totals.plantHours}hrs</>}
            </div>
          )}

          {hasManual && (
            <div className="border-t pt-2">
              <p className="text-xs text-muted-foreground mb-1">+ Foreman-entered:</p>
              {manualEntries.personnel.map(p => (
                <p key={p.id} className="text-xs ml-3">{p.name} ({p.hours || 0}hrs)</p>
              ))}
              {manualEntries.plant.map(p => (
                <p key={p.id} className="text-xs ml-3">{p.description} ({p.hoursOperated || 0}hrs)</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

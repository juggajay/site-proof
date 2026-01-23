// DocketComparisonCard - Compare docket vs diary hours for approval
import { AlertTriangle, CheckCircle2, XCircle, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DocketEntry {
  submitted: number
  approved?: number
  label: string
}

interface DocketComparisonCardProps {
  docketNumber: string
  subcontractor: string
  date: string
  labour: DocketEntry
  plant: DocketEntry
  diaryLabourHours?: number
  diaryPlantHours?: number
  hasDiscrepancy?: boolean
  status: 'pending_approval' | 'approved' | 'rejected' | 'queried'
  onApprove?: () => void
  onReject?: () => void
  onQuery?: () => void
  onViewDetails?: () => void
}

export function DocketComparisonCard({
  docketNumber,
  subcontractor,
  date,
  labour,
  plant,
  diaryLabourHours,
  diaryPlantHours,
  hasDiscrepancy,
  status,
  onApprove,
  onReject,
  onQuery,
  onViewDetails,
}: DocketComparisonCardProps) {
  const labourDiscrepancy = diaryLabourHours !== undefined && Math.abs(labour.submitted - diaryLabourHours) > 0.5
  const plantDiscrepancy = diaryPlantHours !== undefined && Math.abs(plant.submitted - diaryPlantHours) > 0.5

  return (
    <div className="bg-card rounded-lg border overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold">{docketNumber}</h3>
            <p className="text-sm text-muted-foreground">{subcontractor}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">{new Date(date).toLocaleDateString('en-AU')}</p>
            {hasDiscrepancy && (
              <div className="flex items-center gap-1 text-amber-600 text-xs mt-1">
                <AlertTriangle className="h-3 w-3" />
                Discrepancy
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comparison Grid */}
      <div className="p-4">
        <div className="grid grid-cols-3 gap-2 text-center text-sm mb-3">
          <div className="font-medium text-muted-foreground"></div>
          <div className="font-medium">Submitted</div>
          <div className="font-medium">Diary</div>
        </div>

        {/* Labour Row */}
        <div className={cn(
          'grid grid-cols-3 gap-2 text-center py-2 rounded',
          labourDiscrepancy && 'bg-amber-50 dark:bg-amber-900/20'
        )}>
          <div className="text-left font-medium">Labour</div>
          <div>{labour.submitted}h</div>
          <div className={cn(labourDiscrepancy && 'text-amber-600 font-medium')}>
            {diaryLabourHours !== undefined ? `${diaryLabourHours}h` : '-'}
          </div>
        </div>

        {/* Plant Row */}
        <div className={cn(
          'grid grid-cols-3 gap-2 text-center py-2 rounded',
          plantDiscrepancy && 'bg-amber-50 dark:bg-amber-900/20'
        )}>
          <div className="text-left font-medium">Plant</div>
          <div>{plant.submitted}h</div>
          <div className={cn(plantDiscrepancy && 'text-amber-600 font-medium')}>
            {diaryPlantHours !== undefined ? `${diaryPlantHours}h` : '-'}
          </div>
        </div>
      </div>

      {/* Actions */}
      {status === 'pending_approval' && (
        <div className="p-4 border-t bg-muted/30">
          <div className="flex gap-2">
            <button
              onClick={onApprove}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 rounded-lg',
                'bg-green-600 text-white font-medium',
                'active:bg-green-700 transition-colors',
                'touch-manipulation min-h-[48px]'
              )}
            >
              <CheckCircle2 className="h-5 w-5" />
              Approve
            </button>
            <button
              onClick={onQuery}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 rounded-lg',
                'bg-amber-500 text-white font-medium',
                'active:bg-amber-600 transition-colors',
                'touch-manipulation min-h-[48px]'
              )}
            >
              <HelpCircle className="h-5 w-5" />
              Query
            </button>
            <button
              onClick={onReject}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 rounded-lg',
                'bg-red-600 text-white font-medium',
                'active:bg-red-700 transition-colors',
                'touch-manipulation min-h-[48px]'
              )}
            >
              <XCircle className="h-5 w-5" />
              Reject
            </button>
          </div>
        </div>
      )}

      {/* View Details */}
      {onViewDetails && (
        <button
          onClick={onViewDetails}
          className={cn(
            'w-full py-3 text-center text-sm text-primary font-medium',
            'border-t active:bg-muted/50',
            'touch-manipulation min-h-[48px]'
          )}
        >
          View Full Details
        </button>
      )}
    </div>
  )
}

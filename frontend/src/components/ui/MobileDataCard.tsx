import { ReactNode, KeyboardEvent } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DataField {
  label: string
  value: ReactNode
  priority: 'primary' | 'secondary' | 'tertiary'
}

interface MobileDataCardProps {
  title: string
  subtitle?: string
  status?: {
    label: string
    variant: 'default' | 'warning' | 'success' | 'error' | 'info' | 'pending'
  }
  fields: DataField[]
  onClick?: () => void
  actions?: ReactNode
  className?: string
}

const statusColors = {
  default: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200',
  info: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200',
  pending: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200',
}

export function MobileDataCard({
  title,
  subtitle,
  status,
  fields,
  onClick,
  actions,
  className,
}: MobileDataCardProps) {
  const primaryFields = fields.filter(f => f.priority === 'primary')
  const secondaryFields = fields.filter(f => f.priority === 'secondary')

  const handleKeyDown = (e: KeyboardEvent) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      onClick()
    }
  }

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? handleKeyDown : undefined}
      className={cn(
        'bg-card border rounded-xl p-4 space-y-3',
        'transition-all duration-100',
        onClick && 'cursor-pointer touch-manipulation active:scale-[0.98] hover:border-primary/50',
        'focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
        className
      )}
      onClick={onClick}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-base truncate">{title}</h3>
          {subtitle && (
            <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {status && (
            <span className={cn(
              'text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap',
              statusColors[status.variant]
            )}>
              {status.label}
            </span>
          )}
          {onClick && <ChevronRight className="w-5 h-5 text-muted-foreground" />}
        </div>
      </div>

      {/* Primary fields - always visible */}
      {primaryFields.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {primaryFields.map((field, i) => (
            <div key={i} className="min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{field.label}</p>
              <p className="font-medium truncate">{field.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Secondary fields - smaller text */}
      {secondaryFields.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {secondaryFields.map((field, i) => (
            <span key={i}>{field.label}: {field.value}</span>
          ))}
        </div>
      )}

      {/* Actions */}
      {actions && (
        <div className="flex gap-2 pt-2 border-t" onClick={e => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </div>
  )
}

// Skeleton version for loading states
export function MobileDataCardSkeleton() {
  return (
    <div className="bg-card border rounded-xl p-4 space-y-3 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-5 w-32 bg-muted rounded" />
          <div className="h-4 w-48 bg-muted rounded" />
        </div>
        <div className="h-6 w-20 bg-muted rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <div className="h-3 w-16 bg-muted rounded" />
          <div className="h-5 w-24 bg-muted rounded" />
        </div>
        <div className="space-y-1">
          <div className="h-3 w-16 bg-muted rounded" />
          <div className="h-5 w-24 bg-muted rounded" />
        </div>
      </div>
    </div>
  )
}

import { Plus, AlertTriangle, Truck, Wrench, CalendarClock, Users, Clock } from 'lucide-react'
import { SwipeableCard } from './SwipeableCard'
import { cn } from '@/lib/utils'
import { Trash2, Edit2 } from 'lucide-react'

interface TimelineEntry {
  id: string
  type: 'activity' | 'delay' | 'delivery' | 'event' | 'personnel' | 'plant'
  createdAt: string
  description: string
  lot: { id: string; lotNumber: string } | null
  data: any
}

interface DiaryTimelineEntryProps {
  entry: TimelineEntry
  onEdit: (entry: TimelineEntry) => void
  onDelete: (entry: TimelineEntry) => void
  isSubmitted: boolean
}

const typeConfig: Record<string, { icon: typeof Plus; color: string; bgColor: string; label: string }> = {
  activity: { icon: Plus, color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30', label: 'Activity' },
  delay: { icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', label: 'Delay' },
  delivery: { icon: Truck, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', label: 'Delivery' },
  event: { icon: CalendarClock, color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30', label: 'Event' },
  personnel: { icon: Users, color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', label: 'Personnel' },
  plant: { icon: Wrench, color: 'text-gray-600', bgColor: 'bg-gray-100 dark:bg-gray-800', label: 'Plant' },
}

export function DiaryTimelineEntry({ entry, onEdit, onDelete, isSubmitted }: DiaryTimelineEntryProps) {
  const config = typeConfig[entry.type] || typeConfig.activity
  const Icon = config.icon

  const time = new Date(entry.createdAt).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const card = (
    <div
      onClick={() => !isSubmitted && onEdit(entry)}
      className={cn(
        'flex gap-3 p-3 rounded-lg border bg-card',
        !isSubmitted && 'active:bg-muted/50 cursor-pointer'
      )}
    >
      <div className={cn('flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center', config.bgColor)}>
        <Icon className={cn('h-5 w-5', config.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={cn('text-xs font-medium', config.color)}>{config.label}</span>
          <span className="text-xs text-muted-foreground">{time}</span>
          {entry.lot && (
            <span className="text-xs bg-muted px-1.5 py-0.5 rounded">Lot {entry.lot.lotNumber}</span>
          )}
        </div>
        <p className="text-sm font-medium truncate">{entry.description}</p>
        {entry.type === 'delay' && entry.data.durationHours && (
          <p className="text-xs text-muted-foreground mt-0.5">
            <Clock className="inline h-3 w-3 mr-1" />
            {entry.data.durationHours}h — {entry.data.delayType}
          </p>
        )}
        {entry.type === 'delivery' && entry.data.supplier && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {entry.data.supplier}
            {entry.data.quantity && ` · ${entry.data.quantity} ${entry.data.unit || ''}`}
          </p>
        )}
        {entry.type === 'event' && entry.data.eventType && (
          <p className="text-xs text-muted-foreground mt-0.5 capitalize">{entry.data.eventType}</p>
        )}
      </div>
    </div>
  )

  if (isSubmitted) return card

  return (
    <SwipeableCard
      onSwipeLeft={() => onDelete(entry)}
      leftAction={{
        label: 'Delete',
        color: 'bg-red-500',
        icon: <Trash2 className="h-5 w-5" />,
      }}
      rightAction={{
        label: 'Edit',
        color: 'bg-blue-500',
        icon: <Edit2 className="h-5 w-5" />,
      }}
      onSwipeRight={() => onEdit(entry)}
    >
      {card}
    </SwipeableCard>
  )
}

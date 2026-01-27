import { Plus, Clock, Truck, Wrench, AlertTriangle, CalendarClock } from 'lucide-react'
import { cn } from '@/lib/utils'

export type QuickAddType = 'activity' | 'delay' | 'delivery' | 'plant' | 'event' | 'manual'

interface DiaryQuickAddBarProps {
  onChipTap: (type: QuickAddType) => void
  diaryExists: boolean
  isSubmitted: boolean
}

const chips: Array<{ type: QuickAddType; label: string; icon: typeof Plus; color: string }> = [
  { type: 'activity', label: 'Activity', icon: Plus, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  { type: 'delay', label: 'Delay', icon: AlertTriangle, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { type: 'delivery', label: 'Delivery', icon: Truck, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { type: 'plant', label: 'Plant', icon: Wrench, color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  { type: 'event', label: 'Event', icon: CalendarClock, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
]

export function DiaryQuickAddBar({ onChipTap, diaryExists: _diaryExists, isSubmitted }: DiaryQuickAddBarProps) {
  if (isSubmitted) return null

  return (
    <div className="sticky bottom-[72px] z-30 bg-background/95 backdrop-blur border-t px-3 py-2">
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {chips.map(chip => {
          const Icon = chip.icon
          return (
            <button
              key={chip.type}
              onClick={() => onChipTap(chip.type)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap',
                'touch-manipulation min-h-[40px]',
                chip.color
              )}
            >
              <Icon className="h-4 w-4" />
              {chip.label}
            </button>
          )
        })}
        <button
          onClick={() => onChipTap('manual')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap touch-manipulation min-h-[40px] bg-muted text-muted-foreground"
        >
          <Clock className="h-4 w-4" />
          + More
        </button>
      </div>
    </div>
  )
}

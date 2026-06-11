import { Plus, Clock, Truck, Wrench, AlertTriangle, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePublishQuickAddBarHeight } from '@/hooks/useBottomNavHeight';

export type QuickAddType = 'activity' | 'delay' | 'delivery' | 'plant' | 'event' | 'manual';

interface DiaryQuickAddBarProps {
  onChipTap: (type: QuickAddType) => void;
  diaryExists: boolean;
  isSubmitted: boolean;
}

const chips: Array<{ type: QuickAddType; label: string; icon: typeof Plus; color: string }> = [
  {
    type: 'activity',
    label: 'Activity',
    icon: Plus,
    color: 'bg-muted text-foreground',
  },
  {
    type: 'delay',
    label: 'Delay',
    icon: AlertTriangle,
    color: 'bg-muted text-foreground',
  },
  {
    type: 'delivery',
    label: 'Delivery',
    icon: Truck,
    color: 'bg-muted text-foreground',
  },
  { type: 'plant', label: 'Plant', icon: Wrench, color: 'bg-muted text-foreground' },
  {
    type: 'event',
    label: 'Event',
    icon: CalendarClock,
    color: 'bg-muted text-foreground',
  },
];

export function DiaryQuickAddBar({
  onChipTap,
  diaryExists: _diaryExists,
  isSubmitted,
}: DiaryQuickAddBarProps) {
  // Publish bar height to --quick-add-bar-height so .above-quick-add-bar
  // floating UI (offline pill) clears this bar on the diary screen.
  const barRef = usePublishQuickAddBarHeight<HTMLDivElement>();

  if (isSubmitted) return null;

  return (
    // Fixed-position dock: sits directly above the bottom nav via
    // --bottom-nav-height (published by ForemanBottomNavV2). Safe-area-aware
    // so it doesn't overlap the iPhone home indicator.
    <div
      ref={barRef}
      data-testid="diary-quick-add-bar"
      className="fixed bottom-0 left-0 right-0 z-30 border-t bg-background shadow-[0_-4px_16px_rgba(0,0,0,0.08)] ui-chrome"
      style={{
        bottom: 'var(--bottom-nav-height, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="relative px-3 py-2">
        <div
          data-testid="diary-quick-add-rail"
          aria-label="Diary quick add actions"
          className="flex gap-2 overflow-x-auto overscroll-x-contain scroll-smooth pb-1 pr-12 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/40 [&::-webkit-scrollbar-track]:bg-transparent"
        >
          {chips.map((chip) => {
            const Icon = chip.icon;
            return (
              <button
                key={chip.type}
                onClick={() => onChipTap(chip.type)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap',
                  'touch-manipulation min-h-[48px]',
                  chip.color,
                )}
              >
                <Icon className="h-4 w-4" />
                {chip.label}
              </button>
            );
          })}
          <button
            onClick={() => onChipTap('manual')}
            className="flex min-h-[48px] shrink-0 touch-manipulation items-center gap-1.5 rounded-full bg-muted px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground"
          >
            <Clock className="h-4 w-4" />+ More
          </button>
        </div>
        <div
          data-testid="diary-quick-add-scroll-hint"
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent"
        />
      </div>
    </div>
  );
}

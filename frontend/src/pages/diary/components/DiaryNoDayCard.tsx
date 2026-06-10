import { Button } from '@/components/ui/button';

interface DiaryNoDayCardProps {
  onGoToWeather: () => void;
}

/**
 * Desktop sibling of the mobile "Start your day" state. Shown in place of the
 * Personnel/Plant/Activities/Delays tab panels when no diary row exists yet
 * for the selected date — saving Weather is what creates the day's diary, so
 * these tabs have nothing to attach entries to until then. Without this card
 * the panels rendered literally nothing (a regression from commit 822a469d).
 */
export function DiaryNoDayCard({ onGoToWeather }: DiaryNoDayCardProps) {
  return (
    <div className="rounded-lg border bg-card p-8 text-center">
      <svg
        className="mx-auto h-10 w-10 text-muted-foreground"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
        />
      </svg>
      <h3 className="mt-3 text-base font-medium">No diary for this date yet</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Record the weather to start the day's diary — your personnel, plant, activities and delays
        will live here.
      </p>
      <Button className="mt-4" onClick={onGoToWeather}>
        Go to Weather
      </Button>
    </div>
  );
}

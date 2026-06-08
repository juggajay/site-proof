// Feature #438: Okabe-Ito color-blind safe palette passed through to LinearMapView.
export const LOT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-muted text-muted-foreground',
  completed: 'bg-muted text-muted-foreground',
  on_hold: 'bg-warning/10 text-warning',
  not_started: 'bg-muted text-muted-foreground',
};

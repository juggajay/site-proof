// Feature #438: Okabe-Ito color-blind safe palette passed through to LinearMapView.
export const LOT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200',
  in_progress: 'bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-200',
  completed: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200',
  on_hold: 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200',
  not_started: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200',
};

// Monochrome by default — colour reserved for states where a human must decide:
// Hold Point (awaiting release) = warning, NCR Raised (open non-conformance) = destructive.
// Neutral lifecycle states use muted-foreground shades so the eye lands on what needs action.
export const LOT_STATUS_OVERVIEW_ITEMS = [
  {
    key: 'not_started',
    label: 'Not Started',
    description: 'Work has not begun on site.',
    dotClassName: 'bg-muted-foreground/30',
  },
  {
    key: 'in_progress',
    label: 'In Progress',
    description: 'Work is underway but not ready for evidence review.',
    dotClassName: 'bg-muted-foreground/60',
  },
  {
    key: 'awaiting_test',
    label: 'Awaiting Test',
    description: 'The lot needs test evidence before conformance.',
    dotClassName: 'bg-muted-foreground/60',
  },
  {
    key: 'hold_point',
    label: 'Hold Point',
    description: 'Inspection or release is required before work continues.',
    dotClassName: 'bg-warning',
  },
  {
    key: 'ncr_raised',
    label: 'NCR Raised',
    description: 'An open non-conformance must be resolved.',
    dotClassName: 'bg-destructive',
  },
  {
    key: 'completed',
    label: 'Completed',
    description: 'Field work is complete but not yet conformed.',
    dotClassName: 'bg-foreground/70',
  },
  {
    key: 'conformed',
    label: 'Conformed',
    description: 'Quality evidence is approved and the lot can be claimed.',
    dotClassName: 'bg-foreground',
  },
  {
    key: 'claimed',
    label: 'Claimed',
    description: 'The lot is included in a progress claim.',
    dotClassName: 'bg-foreground',
  },
] as const;

export type LotStatusKey = (typeof LOT_STATUS_OVERVIEW_ITEMS)[number]['key'];
export type LotStatusCounts = Record<LotStatusKey, number>;

export const EMPTY_LOT_STATUS_COUNTS: LotStatusCounts = Object.fromEntries(
  LOT_STATUS_OVERVIEW_ITEMS.map((item) => [item.key, 0]),
) as LotStatusCounts;

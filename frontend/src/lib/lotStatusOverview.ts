export const LOT_STATUS_OVERVIEW_ITEMS = [
  {
    key: 'not_started',
    label: 'Not Started',
    description: 'Work has not begun on site.',
    dotClassName: 'bg-slate-400',
  },
  {
    key: 'in_progress',
    label: 'In Progress',
    description: 'Work is underway but not ready for evidence review.',
    dotClassName: 'bg-blue-500',
  },
  {
    key: 'awaiting_test',
    label: 'Awaiting Test',
    description: 'The lot needs test evidence before conformance.',
    dotClassName: 'bg-purple-500',
  },
  {
    key: 'hold_point',
    label: 'Hold Point',
    description: 'Inspection or release is required before work continues.',
    dotClassName: 'bg-amber-500',
  },
  {
    key: 'ncr_raised',
    label: 'NCR Raised',
    description: 'An open non-conformance must be resolved.',
    dotClassName: 'bg-red-500',
  },
  {
    key: 'completed',
    label: 'Completed',
    description: 'Field work is complete but not yet conformed.',
    dotClassName: 'bg-green-500',
  },
  {
    key: 'conformed',
    label: 'Conformed',
    description: 'Quality evidence is approved and the lot can be claimed.',
    dotClassName: 'bg-emerald-600',
  },
  {
    key: 'claimed',
    label: 'Claimed',
    description: 'The lot is included in a progress claim.',
    dotClassName: 'bg-teal-500',
  },
] as const;

export type LotStatusKey = (typeof LOT_STATUS_OVERVIEW_ITEMS)[number]['key'];
export type LotStatusCounts = Record<LotStatusKey, number>;

export const EMPTY_LOT_STATUS_COUNTS: LotStatusCounts = Object.fromEntries(
  LOT_STATUS_OVERVIEW_ITEMS.map((item) => [item.key, 0]),
) as LotStatusCounts;

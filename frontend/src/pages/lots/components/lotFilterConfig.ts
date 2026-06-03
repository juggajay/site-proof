// Lot register filter and column configuration shared by the filters bar,
// table, and page-level persisted preferences.
export const COLUMN_CONFIG = [
  { id: 'lotNumber', label: 'Lot Number', required: true },
  { id: 'description', label: 'Description', required: false },
  { id: 'chainage', label: 'Chainage', required: false },
  { id: 'activityType', label: 'Activity Type', required: false },
  { id: 'status', label: 'Status', required: false },
  { id: 'subcontractor', label: 'Subcontractor', required: false },
  { id: 'budget', label: 'Budget', required: false },
] as const;

export type ColumnId = (typeof COLUMN_CONFIG)[number]['id'];

export const DEFAULT_COLUMN_ORDER: ColumnId[] = [
  'lotNumber',
  'description',
  'chainage',
  'activityType',
  'status',
  'subcontractor',
  'budget',
];

export const COLUMN_STORAGE_KEY = 'siteproof_lot_columns';
export const COLUMN_ORDER_STORAGE_KEY = 'siteproof_lot_column_order';
export const SAVED_FILTERS_STORAGE_KEY = 'siteproof_lot_saved_filters';

export const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'awaiting_test', label: 'Awaiting Test' },
  { value: 'hold_point', label: 'Hold Point' },
  { value: 'ncr_raised', label: 'NCR Raised' },
  { value: 'completed', label: 'Completed' },
  { value: 'conformed', label: 'Conformed' },
  { value: 'claimed', label: 'Claimed' },
];

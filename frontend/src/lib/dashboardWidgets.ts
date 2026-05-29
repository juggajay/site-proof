export const WIDGET_CONFIG = [
  { id: 'attentionItems', label: 'Items Requiring Attention', required: false },
  { id: 'projectSummary', label: 'Project Summary', required: false },
  { id: 'recentActivity', label: 'Recent Activity', required: false },
  { id: 'lotStatus', label: 'Lot Status', required: false },
  { id: 'holdPoints', label: 'Hold Points', required: false },
  { id: 'ncrs', label: 'NCRs', required: false },
  { id: 'quickLinks', label: 'Quick Links', required: false },
] as const;

export type WidgetId = (typeof WIDGET_CONFIG)[number]['id'];

export const DEFAULT_VISIBLE_WIDGETS: WidgetId[] = [
  'attentionItems',
  'projectSummary',
  'recentActivity',
  'lotStatus',
  'holdPoints',
  'ncrs',
  'quickLinks',
];

export const WIDGET_STORAGE_KEY = 'siteproof_dashboard_widgets';

export const VALID_WIDGET_IDS = new Set<WidgetId>(WIDGET_CONFIG.map((widget) => widget.id));

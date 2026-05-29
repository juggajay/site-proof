import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VISIBLE_WIDGETS,
  VALID_WIDGET_IDS,
  WIDGET_CONFIG,
  WIDGET_STORAGE_KEY,
} from './dashboardWidgets';

describe('dashboardWidgets', () => {
  it('keeps widget ids, labels, and storage key stable', () => {
    expect(WIDGET_CONFIG).toEqual([
      { id: 'attentionItems', label: 'Items Requiring Attention', required: false },
      { id: 'projectSummary', label: 'Project Summary', required: false },
      { id: 'recentActivity', label: 'Recent Activity', required: false },
      { id: 'lotStatus', label: 'Lot Status', required: false },
      { id: 'holdPoints', label: 'Hold Points', required: false },
      { id: 'ncrs', label: 'NCRs', required: false },
      { id: 'quickLinks', label: 'Quick Links', required: false },
    ]);
    expect(WIDGET_STORAGE_KEY).toBe('siteproof_dashboard_widgets');
  });

  it('defaults to every configured widget exactly once', () => {
    const configuredIds = WIDGET_CONFIG.map((widget) => widget.id);

    expect(DEFAULT_VISIBLE_WIDGETS).toEqual(configuredIds);
    expect(new Set(DEFAULT_VISIBLE_WIDGETS).size).toBe(DEFAULT_VISIBLE_WIDGETS.length);
  });

  it('validates the configured widget ids', () => {
    expect(Array.from(VALID_WIDGET_IDS)).toEqual(WIDGET_CONFIG.map((widget) => widget.id));
    expect(VALID_WIDGET_IDS.has('attentionItems')).toBe(true);
    expect(VALID_WIDGET_IDS.has('unknownWidget' as never)).toBe(false);
  });
});

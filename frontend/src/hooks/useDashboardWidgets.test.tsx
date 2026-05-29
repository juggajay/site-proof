import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_VISIBLE_WIDGETS, WIDGET_STORAGE_KEY } from '@/lib/dashboardWidgets';
import {
  readLocalStorageItem,
  removeLocalStorageItem,
  writeLocalStorageItem,
} from '@/lib/storagePreferences';
import { parseVisibleWidgetsPreference, useDashboardWidgets } from './useDashboardWidgets';

describe('parseVisibleWidgetsPreference', () => {
  it('falls back to defaults for missing or invalid preferences', () => {
    expect(parseVisibleWidgetsPreference(null)).toEqual(DEFAULT_VISIBLE_WIDGETS);
    expect(parseVisibleWidgetsPreference('not-json')).toEqual(DEFAULT_VISIBLE_WIDGETS);
    expect(parseVisibleWidgetsPreference('{"bad":true}')).toEqual(DEFAULT_VISIBLE_WIDGETS);
  });

  it('keeps valid widget ids once and drops unknown ids', () => {
    expect(
      parseVisibleWidgetsPreference(
        JSON.stringify(['projectSummary', 'unknownWidget', 'projectSummary', 'quickLinks']),
      ),
    ).toEqual(['projectSummary', 'quickLinks']);
  });
});

describe('useDashboardWidgets', () => {
  afterEach(() => {
    removeLocalStorageItem(WIDGET_STORAGE_KEY);
  });

  it('loads persisted widget preferences', () => {
    writeLocalStorageItem(WIDGET_STORAGE_KEY, JSON.stringify(['projectSummary', 'quickLinks']));

    const { result } = renderHook(() => useDashboardWidgets());

    expect(result.current.visibleWidgets).toEqual(['projectSummary', 'quickLinks']);
    expect(result.current.isWidgetVisible('projectSummary')).toBe(true);
    expect(result.current.isWidgetVisible('recentActivity')).toBe(false);
  });

  it('persists widget visibility changes', () => {
    const { result } = renderHook(() => useDashboardWidgets());

    act(() => {
      result.current.toggleWidget('recentActivity');
    });

    expect(result.current.visibleWidgets).not.toContain('recentActivity');
    expect(JSON.parse(readLocalStorageItem(WIDGET_STORAGE_KEY) ?? '[]')).not.toContain(
      'recentActivity',
    );

    act(() => {
      result.current.toggleWidget('recentActivity');
    });

    expect(result.current.visibleWidgets).toContain('recentActivity');
    expect(JSON.parse(readLocalStorageItem(WIDGET_STORAGE_KEY) ?? '[]')).toContain(
      'recentActivity',
    );
  });
});

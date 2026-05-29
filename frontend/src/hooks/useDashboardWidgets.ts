import { useCallback, useState } from 'react';
import {
  DEFAULT_VISIBLE_WIDGETS,
  VALID_WIDGET_IDS,
  WIDGET_STORAGE_KEY,
  type WidgetId,
} from '@/lib/dashboardWidgets';
import {
  parseJsonPreference,
  readLocalStorageItem,
  writeLocalStorageItem,
} from '@/lib/storagePreferences';

export function parseVisibleWidgetsPreference(raw: string | null): WidgetId[] {
  return parseJsonPreference(raw, DEFAULT_VISIBLE_WIDGETS, (value) => {
    if (!Array.isArray(value)) return null;

    const widgets = value.filter(
      (item): item is WidgetId =>
        typeof item === 'string' && VALID_WIDGET_IDS.has(item as WidgetId),
    );

    return Array.from(new Set(widgets));
  });
}

export function useDashboardWidgets() {
  const [visibleWidgets, setVisibleWidgets] = useState<WidgetId[]>(() => {
    return parseVisibleWidgetsPreference(readLocalStorageItem(WIDGET_STORAGE_KEY));
  });

  const isWidgetVisible = useCallback(
    (widgetId: WidgetId) => visibleWidgets.includes(widgetId),
    [visibleWidgets],
  );

  const toggleWidget = useCallback((widgetId: WidgetId) => {
    setVisibleWidgets((previousWidgets) => {
      const nextWidgets = previousWidgets.includes(widgetId)
        ? previousWidgets.filter((widget) => widget !== widgetId)
        : [...previousWidgets, widgetId];

      writeLocalStorageItem(WIDGET_STORAGE_KEY, JSON.stringify(nextWidgets));
      return nextWidgets;
    });
  }, []);

  return {
    visibleWidgets,
    isWidgetVisible,
    toggleWidget,
  };
}

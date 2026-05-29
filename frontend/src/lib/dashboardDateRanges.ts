import { formatDateKey } from './localDate';

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'last30days'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisQuarter'
  | 'custom';

export const DATE_RANGE_PRESETS: {
  value: DateRangePreset;
  label: string;
  getRange: () => { start: Date; end: Date };
}[] = [
  {
    value: 'today',
    label: 'Today',
    getRange: () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      return { start: today, end };
    },
  },
  {
    value: 'yesterday',
    label: 'Yesterday',
    getRange: () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const end = new Date(yesterday);
      end.setHours(23, 59, 59, 999);
      return { start: yesterday, end };
    },
  },
  {
    value: 'last7days',
    label: 'Last 7 Days',
    getRange: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    },
  },
  {
    value: 'last30days',
    label: 'Last 30 Days',
    getRange: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    },
  },
  {
    value: 'thisMonth',
    label: 'This Month',
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date();
      return { start, end };
    },
  },
  {
    value: 'lastMonth',
    label: 'Last Month',
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    },
  },
  {
    value: 'thisQuarter',
    label: 'This Quarter',
    getRange: () => {
      const now = new Date();
      const quarter = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), quarter * 3, 1);
      const end = new Date();
      return { start, end };
    },
  },
];

export const formatDateForApi = (date: Date): string => {
  return formatDateKey(date);
};

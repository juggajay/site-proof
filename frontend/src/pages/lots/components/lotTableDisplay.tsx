// Display and persistence helpers shared by the lot register table.
import type React from 'react';
import type { Lot } from '../lotsPageTypes';
import { isRecord, parseJsonPreference } from '@/lib/storagePreferences';

// Default column widths in pixels. The budget is set so that the whole table —
// select column + these + the actions column — fits a 1440px window without
// horizontal overflow, which is what used to clip the row actions.
export const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  lotNumber: 140,
  description: 130,
  chainage: 110,
  activityType: 180,
  status: 110,
  subcontractor: 120,
  budget: 100,
};

// Wide enough for the expand chevron and the select checkbox side by side. At
// the old 40px the checkbox overflowed into the lot-number cell and read as a
// missing-glyph box before every lot number.
export const SELECT_COLUMN_WIDTH = 72;

// Fixed so the actions cell can never be squeezed to a partial word.
export const ACTIONS_COLUMN_WIDTH = 104;

// v2: the pre-rebalance widths were saved per user and would otherwise keep the
// overflowing layout alive after the defaults were fixed.
export const COLUMN_WIDTH_STORAGE_KEY = 'siteproof_lot_column_widths_v2';
export const MIN_COLUMN_WIDTH = 60;
export const MAX_COLUMN_WIDTH = 600;

// Helper function to highlight search terms in text
export function highlightSearchTerm(text: string, searchTerm: string): React.ReactNode {
  if (!searchTerm || !text) return text;

  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  if (parts.length === 1) return text;

  return parts.map((part, index) =>
    regex.test(part) ? (
      <mark key={index} className="bg-brand/20 text-foreground px-0.5 rounded">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

// Format chainage for display
export function formatChainage(lot: Lot) {
  if (lot.chainageStart != null && lot.chainageEnd != null) {
    return lot.chainageStart === lot.chainageEnd
      ? `${lot.chainageStart}`
      : `${lot.chainageStart}-${lot.chainageEnd}`;
  }
  return lot.chainageStart ?? lot.chainageEnd ?? '\u2014';
}

export function parseColumnWidthsPreference(raw: string | null): Record<string, number> {
  return parseJsonPreference(raw, DEFAULT_COLUMN_WIDTHS, (value) => {
    if (!isRecord(value)) return null;

    const widths = { ...DEFAULT_COLUMN_WIDTHS };
    for (const columnId of Object.keys(DEFAULT_COLUMN_WIDTHS)) {
      const width = value[columnId];
      if (typeof width === 'number' && Number.isFinite(width)) {
        widths[columnId] = Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, width));
      }
    }

    return widths;
  });
}

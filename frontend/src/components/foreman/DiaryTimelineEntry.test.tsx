/**
 * Render tests for DiaryTimelineEntry — specifically the auto-compiled QA row
 * affordances added with the diary QA auto-events pipeline (#1461):
 *  - the "Auto" badge renders for system-sourced rows (data.source !== 'manual')
 *    and is absent for manual rows (and legacy rows with no source);
 *  - underscored eventTypes render human-readably (spaces, not underscores).
 */
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/renderWithProviders';
import { DiaryTimelineEntry, type TimelineEntry } from './DiaryTimelineEntry';

function buildEntry(overrides: Partial<TimelineEntry> = {}): TimelineEntry {
  return {
    id: 'evt-1',
    type: 'event',
    createdAt: '2026-07-14T02:30:00.000Z',
    description: 'ITP: 1 passed, 1 failed — Earthworks ITP',
    lot: null,
    data: {},
    ...overrides,
  };
}

function renderEntry(entry: TimelineEntry) {
  return renderWithProviders(
    <DiaryTimelineEntry entry={entry} onEdit={vi.fn()} onDelete={vi.fn()} isSubmitted={false} />,
  );
}

describe('DiaryTimelineEntry', () => {
  it('renders the "Auto" badge for QA-sourced rows', () => {
    renderEntry(buildEntry({ data: { source: 'qa', eventType: 'itp_progress' } }));
    expect(screen.getByText('Auto')).toBeInTheDocument();
  });

  it('does not render the "Auto" badge for manual rows', () => {
    renderEntry(buildEntry({ data: { source: 'manual', eventType: 'safety' } }));
    expect(screen.queryByText('Auto')).not.toBeInTheDocument();
  });

  it('does not render the "Auto" badge for legacy rows with no source', () => {
    renderEntry(buildEntry({ data: { eventType: 'safety' } }));
    expect(screen.queryByText('Auto')).not.toBeInTheDocument();
  });

  it('renders underscored eventTypes with spaces', () => {
    renderEntry(buildEntry({ data: { source: 'qa', eventType: 'ncr_raised' } }));
    expect(screen.getByText('ncr raised')).toBeInTheDocument();
    expect(screen.queryByText('ncr_raised')).not.toBeInTheDocument();
  });
});

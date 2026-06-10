/**
 * Render tests for the "copy from yesterday" affordance in DiaryMobileView.
 *
 * Covers:
 *  - Affordance is shown when diary exists, diary is a draft, no personnel or
 *    plant entries in the timeline, and copy callbacks are provided.
 *  - Crew and Plant buttons are present and call the right handlers.
 *  - Affordance is hidden when the diary is null (no diary started yet).
 *  - Affordance is hidden once there are existing timeline entries.
 *  - Affordance is hidden when the diary is submitted.
 */

import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/renderWithProviders';
import { DiaryMobileView } from './DiaryMobileView';
import type { DailyDiary } from '@/pages/diary/types';
import type { TimelineEntry } from './DiaryTimelineEntry';
import { formatDateKey } from '@/lib/localDate';

const TODAY = formatDateKey();

type ViewProps = Parameters<typeof DiaryMobileView>[0];

function buildProps(overrides: Partial<ViewProps> = {}): ViewProps {
  return {
    selectedDate: TODAY,
    lots: [],
    activeLotId: null,
    onLotChange: vi.fn(),
    weather: null,
    weatherSource: null,
    fetchingWeather: false,
    onEditWeather: vi.fn(),
    diary: { status: 'draft' } as Pick<DailyDiary, 'status'>,
    loading: false,
    docketSummary: null,
    docketSummaryLoading: false,
    timeline: [],
    onQuickAdd: vi.fn(),
    onRefresh: vi.fn().mockResolvedValue(undefined),
    onEditEntry: vi.fn(),
    onDeleteEntry: vi.fn(),
    onCopyPersonnelFromYesterday: vi.fn().mockResolvedValue(undefined),
    onCopyPlantFromYesterday: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('DiaryMobileView copy-from-yesterday affordance', () => {
  it('shows the affordance when diary is draft and there are no entries', () => {
    renderWithProviders(<DiaryMobileView {...buildProps()} />);
    expect(screen.getByTestId('copy-from-yesterday-affordance')).toBeInTheDocument();
    expect(screen.getByTestId('copy-personnel-btn')).toBeInTheDocument();
    expect(screen.getByTestId('copy-plant-btn')).toBeInTheDocument();
  });

  it('calls onCopyPersonnelFromYesterday when Crew button is tapped', () => {
    const onCopyPersonnelFromYesterday = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<DiaryMobileView {...buildProps({ onCopyPersonnelFromYesterday })} />);
    fireEvent.click(screen.getByTestId('copy-personnel-btn'));
    expect(onCopyPersonnelFromYesterday).toHaveBeenCalledTimes(1);
  });

  it('calls onCopyPlantFromYesterday when Plant button is tapped', () => {
    const onCopyPlantFromYesterday = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<DiaryMobileView {...buildProps({ onCopyPlantFromYesterday })} />);
    fireEvent.click(screen.getByTestId('copy-plant-btn'));
    expect(onCopyPlantFromYesterday).toHaveBeenCalledTimes(1);
  });

  it('hides the affordance when diary is null (weather not yet recorded)', () => {
    renderWithProviders(<DiaryMobileView {...buildProps({ diary: null })} />);
    expect(screen.queryByTestId('copy-from-yesterday-affordance')).not.toBeInTheDocument();
  });

  it('hides the affordance when there are existing personnel entries', () => {
    const personnelEntry: TimelineEntry = {
      id: 'p-1',
      type: 'personnel',
      description: 'Alice',
      createdAt: '2026-06-11T07:00:00.000Z',
      lot: null,
      data: {},
    };
    renderWithProviders(<DiaryMobileView {...buildProps({ timeline: [personnelEntry] })} />);
    expect(screen.queryByTestId('copy-from-yesterday-affordance')).not.toBeInTheDocument();
  });

  it('hides the affordance when there are existing plant entries', () => {
    const plantEntry: TimelineEntry = {
      id: 'pl-1',
      type: 'plant',
      description: 'Excavator',
      createdAt: '2026-06-11T07:00:00.000Z',
      lot: null,
      data: {},
    };
    renderWithProviders(<DiaryMobileView {...buildProps({ timeline: [plantEntry] })} />);
    expect(screen.queryByTestId('copy-from-yesterday-affordance')).not.toBeInTheDocument();
  });

  it('hides the affordance when the diary is submitted', () => {
    renderWithProviders(
      <DiaryMobileView
        {...buildProps({ diary: { status: 'submitted' } as Pick<DailyDiary, 'status'> })}
      />,
    );
    expect(screen.queryByTestId('copy-from-yesterday-affordance')).not.toBeInTheDocument();
  });

  it('hides the affordance when no copy callbacks are provided', () => {
    renderWithProviders(
      <DiaryMobileView
        {...buildProps({
          onCopyPersonnelFromYesterday: undefined,
          onCopyPlantFromYesterday: undefined,
        })}
      />,
    );
    expect(screen.queryByTestId('copy-from-yesterday-affordance')).not.toBeInTheDocument();
  });
});

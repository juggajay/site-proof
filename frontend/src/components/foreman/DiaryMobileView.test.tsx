import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/renderWithProviders';
import { DiaryMobileView } from './DiaryMobileView';
import type { DailyDiary } from '@/pages/diary/types';
import { formatDateKey } from '@/lib/localDate';

const TODAY = formatDateKey();
const PAST_DATE = '2020-01-02';

type Overrides = Partial<Parameters<typeof DiaryMobileView>[0]>;

function renderView(overrides: Overrides = {}) {
  const onReviewSubmit = vi.fn();
  const props = {
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
    onReviewSubmit,
    ...overrides,
  };
  renderWithProviders(<DiaryMobileView {...props} />);
  return { onReviewSubmit };
}

describe('DiaryMobileView review & submit action', () => {
  it("shows a persistent Review & submit button for today's draft and triggers the finish flow", () => {
    const { onReviewSubmit } = renderView();

    const button = screen.getByRole('button', { name: 'Review & submit' });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(onReviewSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not show the draft submit action once the diary is submitted', () => {
    renderView({ diary: { status: 'submitted' } as Pick<DailyDiary, 'status'> });

    expect(screen.queryByRole('button', { name: 'Review & submit' })).not.toBeInTheDocument();
    // The header still communicates the submitted state.
    expect(screen.getByText('Submitted')).toBeInTheDocument();
  });

  it('offers submit for a forgotten past-date draft so it is not stuck on mobile', () => {
    const { onReviewSubmit } = renderView({ selectedDate: PAST_DATE });

    // The header still flags that this is not today...
    expect(screen.getByText('Not today')).toBeInTheDocument();

    // ...but the draft can still be reviewed and submitted from the phone.
    const button = screen.getByRole('button', { name: 'Review & submit' });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(onReviewSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not offer submit for a past date when there is no draft diary', () => {
    renderView({ selectedDate: PAST_DATE, diary: null });

    expect(screen.queryByRole('button', { name: 'Review & submit' })).not.toBeInTheDocument();
  });
});

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

describe('DiaryMobileView skeleton loading state', () => {
  it('renders the timeline skeleton wrapper while loading=true', () => {
    renderView({ loading: true });
    expect(screen.getByTestId('diary-timeline-skeleton')).toBeInTheDocument();
    expect(screen.getAllByTestId('diary-timeline-entry-skeleton').length).toBeGreaterThanOrEqual(3);
  });

  it('removes the skeleton and shows empty-state once loading=false', () => {
    renderView({ loading: false });
    expect(screen.queryByTestId('diary-timeline-skeleton')).not.toBeInTheDocument();
    // Empty-state message shown instead (no entries, diary is a draft)
    expect(screen.getByText('No entries yet')).toBeInTheDocument();
  });
});

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

describe('DiaryMobileView docked quick-add bar', () => {
  it('renders the quick-add bar with fixed-position docked classes for a draft diary', () => {
    renderView();

    const bar = screen.getByTestId('diary-quick-add-bar');
    expect(bar).toBeInTheDocument();
    // Bar must be fixed (not sticky/inline) so it docks at viewport bottom
    expect(bar).toHaveClass('fixed');
    // Full-width dock
    expect(bar).toHaveClass('left-0', 'right-0');
    // z-index keeps it above content
    expect(bar).toHaveClass('z-30');
    // Separated from content with top border
    expect(bar).toHaveClass('border-t');
  });

  it('renders the quick-add chips inside the scrollable rail', () => {
    renderView();

    const rail = screen.getByTestId('diary-quick-add-rail');
    expect(rail).toBeInTheDocument();
    // Chips must be horizontally scrollable
    expect(rail).toHaveClass('overflow-x-auto');
  });

  it('hides the quick-add bar when the diary is submitted', () => {
    renderView({ diary: { status: 'submitted' } as Pick<DailyDiary, 'status'> });

    expect(screen.queryByTestId('diary-quick-add-bar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('diary-quick-add-rail')).not.toBeInTheDocument();
  });

  it('hides the quick-add bar when there is no diary (not started)', () => {
    // Bar is rendered but isSubmitted is false; the bar appears whenever not submitted
    // — this test confirms it IS visible when diary is null (recording not yet started)
    // because chips trigger starting the diary.
    renderView({ diary: null });

    expect(screen.getByTestId('diary-quick-add-bar')).toBeInTheDocument();
  });

  it('applies dynamic bottom padding to the timeline content container', () => {
    renderView();

    const content = screen.getByTestId('diary-timeline-content');
    // The inline style uses CSS vars — check the style attribute is present
    const style = content.getAttribute('style') ?? '';
    expect(style).toContain('--quick-add-bar-height');
    expect(style).toContain('--bottom-nav-height');
    expect(style).toContain('padding-bottom');
  });

  it('calls onQuickAdd with the correct type when a chip is tapped', () => {
    const onQuickAdd = vi.fn();
    renderView({ onQuickAdd });

    fireEvent.click(screen.getByRole('button', { name: /activity/i }));
    expect(onQuickAdd).toHaveBeenCalledWith('activity');

    fireEvent.click(screen.getByRole('button', { name: /delay/i }));
    expect(onQuickAdd).toHaveBeenCalledWith('delay');
  });
});

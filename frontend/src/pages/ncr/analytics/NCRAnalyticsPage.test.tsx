/**
 * Wave G G5 AT-G26, frontend half — the analytics that already ship, rendered.
 *
 * The endpoint has computed all of this since it shipped and had zero
 * consumers; these tests pin the three things that were unrenderable or missing
 * before: subcontractor NAMES (the shipped shape returned bare ids), the
 * explicit "Activity not classified" bucket (AT-G28), and the honest coverage
 * statement on recurring ITP failures.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { NcrAnalytics } from './ncrAnalyticsTypes';

// `vi.hoisted` because vitest hoists every `vi.mock` above the consts in this
// file, so a factory closing over a plain `const` would hit its temporal dead
// zone.
const { apiGetMock, FakeApiError } = vi.hoisted(() => ({
  apiGetMock: vi.fn(),
  FakeApiError: class FakeApiError extends Error {
    status: number;
    constructor(status: number) {
      super(`status ${status}`);
      this.status = status;
    }
  },
}));

vi.mock('@/lib/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  apiPost: vi.fn(),
  ApiError: FakeApiError,
}));

// recharts needs a laid-out container, which jsdom never gives it. The chart
// stubs render the series LABELS as text so the assertions can still be about
// what a reader sees — which for AT-G28 is the whole point.
vi.mock('@/components/charts', () => ({
  Bar: () => null,
  BarChart: ({ data }: { data?: Array<{ key: string; name: string; value: number }> }) => (
    <ul data-testid="bar-chart">
      {(data ?? []).map((datum) => (
        <li key={datum.key}>{`${datum.name}: ${datum.value}`}</li>
      ))}
    </ul>
  ),
  CartesianGrid: () => null,
  Line: () => null,
  LineChart: () => null,
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

import { NCRAnalyticsPage } from './NCRAnalyticsPage';

function analytics(overrides: Partial<NcrAnalytics> = {}): NcrAnalytics {
  return {
    summary: { total: 7, open: 3, closed: 4, overdue: 1, avgDaysToClose: 5.5, closureRate: 57 },
    charts: {
      rootCause: {
        title: 'NCRs by Root Cause',
        data: [{ key: 'process', name: 'Process', value: 4, percentage: 57 }],
      },
      category: {
        title: 'NCRs by Category',
        data: [{ key: 'materials', name: 'Materials', value: 3, percentage: 43 }],
      },
      activity: {
        title: 'NCRs by Work Type',
        description: 'Lot activity the NCR was raised against.',
        data: [
          { key: 'earthworks_general', name: 'earthworks_general', value: 5, percentage: 71 },
          { key: 'not_classified', name: 'Activity not classified', value: 2, percentage: 29 },
        ],
      },
      severity: { title: 'NCRs by Severity', data: [] },
      status: { title: 'NCRs by Status', data: [] },
      closureTimeTrend: { title: 'Average Closure Time Trend', data: [], overallAvg: 5.5 },
      volumeTrend: {
        title: 'NCR Volume Trend',
        description: 'Number of NCRs raised by month',
        data: [{ month: '2026-06', count: 7 }],
      },
    },
    repeatIssues: {
      title: 'Repeat Issues',
      description: 'NCRs grouped by category and root cause showing recurring problems',
      data: [
        {
          category: 'materials',
          categoryLabel: 'Materials',
          rootCause: 'process',
          rootCauseLabel: 'Process',
          count: 3,
        },
      ],
      totalRepeatGroups: 1,
    },
    repeatOffenders: {
      title: 'Subcontractors with Multiple NCRs',
      description: 'Subcontractors responsible for 2 or more NCRs',
      data: [
        {
          subcontractorId: 'sub-1',
          subcontractorName: 'Acme Civil',
          ncrCount: 4,
          categories: ['materials', 'workmanship'],
          categoryCount: 2,
        },
      ],
    },
    recurringItems: {
      title: 'Recurring ITP Failures',
      description: 'Checklist items that failed two or more times',
      data: [
        {
          rootChecklistItemId: 'root-1',
          description: 'Compaction test at 300mm layers',
          templateId: 'tpl-1',
          templateName: 'Bulk earthworks',
          ncrCount: 7,
          subcontractorCount: 3,
          activitySlugs: ['earthworks_general'],
          checklistItemIds: ['item-a'],
        },
      ],
      coverage: { linked: 7, total: 12, itemsWithoutLineage: 1, itemsObserved: 2 },
    },
    ...overrides,
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/projects/p1/ncr/analytics']}>
        <Routes>
          <Route path="/projects/:projectId/ncr/analytics" element={<NCRAnalyticsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('NCRAnalyticsPage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
  });

  it('AT-G26 renders root cause, repeat issues and NAMED repeat offenders', async () => {
    apiGetMock.mockResolvedValue(analytics());
    renderPage();

    expect(await screen.findByText('NCR trends')).toBeInTheDocument();
    expect(screen.getByText('NCRs by Root Cause')).toBeInTheDocument();
    expect(screen.getByText('Materials · Process')).toBeInTheDocument();
    // The shipped response returned a bare subcontractor id, which is
    // unrenderable without a second round trip the caller cannot authorise.
    expect(screen.getByText('Acme Civil')).toBeInTheDocument();
    expect(screen.queryByText('sub-1')).not.toBeInTheDocument();
  });

  it('AT-G28 shows the "Activity not classified" bucket instead of hiding it', async () => {
    apiGetMock.mockResolvedValue(analytics());
    renderPage();

    expect(await screen.findByText('NCRs by Work Type')).toBeInTheDocument();
    // The bucket is a finding about the data ("we do not know what work this
    // was"), not an absence to be filtered out of the chart.
    expect(screen.getByText('Activity not classified: 2')).toBeInTheDocument();
    expect(screen.getByText('earthworks_general: 5')).toBeInTheDocument();
  });

  it('states recurring-failure coverage rather than implying it sees every NCR', async () => {
    apiGetMock.mockResolvedValue(analytics());
    renderPage();

    expect(await screen.findByText(/Based on 7 of 12 NCRs/)).toBeInTheDocument();
    expect(screen.getByText(/1 of 2 items predate template lineage/)).toBeInTheDocument();
    expect(screen.getByText('Compaction test at 300mm layers')).toBeInTheDocument();
    expect(screen.getByText(/failed 7 times across 3 subcontractors/)).toBeInTheDocument();
  });

  it('says the surface is an office view when the backend refuses (§7 row 7)', async () => {
    apiGetMock.mockRejectedValue(new FakeApiError(403));
    renderPage();

    await waitFor(() =>
      expect(screen.getByText('NCR trends are an office view')).toBeInTheDocument(),
    );
  });

  it('renders empty states without pretending there is a trend', async () => {
    apiGetMock.mockResolvedValue(
      analytics({
        repeatIssues: { title: 'Repeat Issues', description: '', data: [], totalRepeatGroups: 0 },
        repeatOffenders: { title: 'Subcontractors with Multiple NCRs', description: '', data: [] },
      }),
    );
    renderPage();

    expect(
      await screen.findByText(/no category and root cause pairing appears twice/),
    ).toBeInTheDocument();
    expect(
      screen.getByText('No subcontractor carries two or more NCRs on this project.'),
    ).toBeInTheDocument();
  });
});

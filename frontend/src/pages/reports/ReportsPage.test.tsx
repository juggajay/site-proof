import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DateFormatProvider } from '@/lib/dateFormat';
import { TimezoneProvider } from '@/lib/timezone';
import { apiFetch } from '@/lib/api';
import { ReportsPage } from './ReportsPage';
import type { DiaryReport, LotStatusReport } from './types';

vi.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    body: string;
    data: null;

    constructor(status: number, body: string) {
      super(`API Error ${status}: ${body}`);
      this.name = 'ApiError';
      this.status = status;
      this.body = body;
      this.data = null;
    }
  },
  apiFetch: vi.fn(),
  apiUrl: (path: string) => path,
}));

vi.mock('@/components/reports/ScheduleReportModal', () => ({
  ScheduleReportModal: () => <div data-testid="schedule-report-modal" />,
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'admin@example.com',
      role: 'admin',
      roleInCompany: 'admin',
      dashboardRole: null,
    },
  }),
}));

const apiFetchMock = vi.mocked(apiFetch);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function buildDiaryReport(): DiaryReport {
  return {
    generatedAt: '2026-06-21T05:00:00.000Z',
    projectId: 'project-1',
    dateRange: { startDate: null, endDate: null },
    selectedSections: ['weather', 'personnel', 'plant', 'activities', 'delays'],
    totalDiaries: 1,
    submittedCount: 1,
    draftCount: 0,
    diaries: [
      {
        id: 'diary-1',
        date: '2026-06-21T00:00:00.000Z',
        status: 'submitted',
        isLate: false,
        weatherConditions: 'Partly Cloudy',
        temperatureMin: 11,
        temperatureMax: 23,
        personnel: [],
        plant: [],
        activities: [],
        delays: [],
      },
    ],
    summary: {
      weather: { 'Partly Cloudy': 1 },
      personnel: { totalPersonnel: 0, totalHours: 0, byCompany: {} },
      plant: { totalPlant: 0, totalHours: 0, byCompany: {} },
      activities: { totalActivities: 0, byLot: {} },
      delays: { totalDelays: 0, totalHours: 0, byType: {} },
    },
  };
}

function buildLotStatusReport(): LotStatusReport {
  return {
    generatedAt: '2026-06-21T05:00:00.000Z',
    projectId: 'project-1',
    totalLots: 1,
    statusCounts: { conformed: 1 },
    activityCounts: { Earthworks: 1 },
    lots: [
      {
        id: 'lot-1',
        lotNumber: 'LOT-STALE-001',
        description: 'Previously loaded lot',
        status: 'conformed',
        activityType: 'Earthworks',
        chainageStart: null,
        chainageEnd: null,
        offset: null,
        layer: null,
        areaZone: null,
        createdAt: '2026-06-21T00:00:00.000Z',
        conformedAt: '2026-06-21T04:00:00.000Z',
      },
    ],
    summary: {
      notStarted: 0,
      inProgress: 0,
      awaitingTest: 0,
      holdPoint: 0,
      ncrRaised: 0,
      conformed: 1,
      claimed: 0,
    },
  };
}

function renderReportsPage(initialEntry = '/projects/project-1/reports?tab=diary') {
  render(
    <DateFormatProvider>
      <TimezoneProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/projects/:projectId/reports" element={<ReportsPage />} />
          </Routes>
        </MemoryRouter>
      </TimezoneProvider>
    </DateFormatProvider>,
  );
}

describe('ReportsPage diary tab', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('keeps diary report filters mounted while generating', async () => {
    const firstReport = buildDiaryReport();
    const secondReport = buildDiaryReport();
    const secondReportRequest = deferred<DiaryReport>();
    const reportRequests: Array<DiaryReport | Promise<DiaryReport>> = [
      firstReport,
      secondReportRequest.promise,
    ];

    apiFetchMock.mockImplementation((path) => {
      if (path === '/api/company') {
        return Promise.resolve({
          company: { subscriptionTier: 'basic', name: 'QA Company', logoUrl: null },
        });
      }

      if (path === '/api/projects/project-1') {
        return Promise.resolve({ name: 'QA Project' });
      }

      if (path.startsWith('/api/reports/diary?')) {
        const nextReport = reportRequests.shift() ?? secondReport;
        return Promise.resolve(nextReport);
      }

      return Promise.reject(new Error(`Unexpected API path: ${path}`));
    });

    renderReportsPage();

    expect(await screen.findByText('Total Diaries')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('diary-date-preset-today'));
    const startInput = screen.getByLabelText('Diary report start date') as HTMLInputElement;
    const endInput = screen.getByLabelText('Diary report end date') as HTMLInputElement;
    const selectedStartDate = startInput.value;
    const selectedEndDate = endInput.value;

    expect(selectedStartDate).not.toBe('');
    expect(selectedEndDate).not.toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'Generate Report' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Loading report data...');
    expect(screen.getByLabelText('Diary report start date')).toHaveValue(selectedStartDate);
    expect(screen.getByLabelText('Diary report end date')).toHaveValue(selectedEndDate);

    secondReportRequest.resolve(secondReport);

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    expect(screen.getByLabelText('Diary report start date')).toHaveValue(selectedStartDate);
    expect(screen.getByLabelText('Diary report end date')).toHaveValue(selectedEndDate);
    expect(apiFetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`startDate=${selectedStartDate}`),
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`endDate=${selectedEndDate}`),
    );

    apiFetchMock.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh Report' }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`startDate=${selectedStartDate}`),
      );
    });
    expect(apiFetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`endDate=${selectedEndDate}`),
    );
  });
});

describe('ReportsPage stale report handling', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('clears the active report instead of showing stale data after refresh fails', async () => {
    const firstReport = buildLotStatusReport();
    let lotStatusRequestCount = 0;

    apiFetchMock.mockImplementation((path) => {
      if (path === '/api/company') {
        return Promise.resolve({
          company: { subscriptionTier: 'professional', name: 'QA Company', logoUrl: null },
        });
      }

      if (path === '/api/projects/project-1') {
        return Promise.resolve({
          project: { name: 'QA Project', currentUserRole: 'project_manager' },
        });
      }

      if (path.startsWith('/api/reports/lot-status?')) {
        lotStatusRequestCount += 1;
        if (lotStatusRequestCount === 1) {
          return Promise.resolve(firstReport);
        }

        return Promise.reject(new Error('Report service unavailable'));
      }

      return Promise.reject(new Error(`Unexpected API path: ${path}`));
    });

    renderReportsPage('/projects/project-1/reports?tab=lot-status');

    expect(await screen.findByText('LOT-STALE-001')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh Report' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Report service unavailable');
    expect(screen.queryByText('LOT-STALE-001')).not.toBeInTheDocument();
  });
});

describe('ReportsPage print action', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('shows a print/save PDF action when a report has loaded', async () => {
    const printMock = vi.fn();
    Object.defineProperty(window, 'print', {
      configurable: true,
      value: printMock,
    });

    apiFetchMock.mockImplementation((path) => {
      if (path === '/api/company') {
        return Promise.resolve({
          company: { subscriptionTier: 'professional', name: 'QA Company', logoUrl: null },
        });
      }

      if (path === '/api/projects/project-1') {
        return Promise.resolve({
          project: { name: 'QA Project', currentUserRole: 'project_manager' },
        });
      }

      if (path.startsWith('/api/reports/lot-status?')) {
        return Promise.resolve(buildLotStatusReport());
      }

      return Promise.reject(new Error(`Unexpected API path: ${path}`));
    });

    renderReportsPage('/projects/project-1/reports?tab=lot-status');

    expect(await screen.findByText('LOT-STALE-001')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Print / Save PDF' }));
    expect(printMock).toHaveBeenCalledTimes(1);
  });

  it('does not send a referrer when rendering an external company logo in the print header', async () => {
    apiFetchMock.mockImplementation((path) => {
      if (path === '/api/company') {
        return Promise.resolve({
          company: {
            subscriptionTier: 'professional',
            name: 'QA Company',
            logoUrl: 'https://cdn.example.com/logo.png',
          },
        });
      }

      if (path === '/api/projects/project-1') {
        return Promise.resolve({
          project: { name: 'QA Project', currentUserRole: 'project_manager' },
        });
      }

      if (path.startsWith('/api/reports/lot-status?')) {
        return Promise.resolve(buildLotStatusReport());
      }

      return Promise.reject(new Error(`Unexpected API path: ${path}`));
    });

    renderReportsPage('/projects/project-1/reports?tab=lot-status');

    const logo = await screen.findByAltText('QA Company');
    expect(logo).toHaveAttribute('src', 'https://cdn.example.com/logo.png');
    expect(logo).toHaveAttribute('referrerpolicy', 'no-referrer');
  });
});

describe('ReportsPage subscription tier gates', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  function mockCompanyAndDiary(subscriptionTier: string) {
    apiFetchMock.mockImplementation((path) => {
      if (path === '/api/company') {
        return Promise.resolve({
          company: { subscriptionTier, name: 'QA Company', logoUrl: null },
        });
      }

      if (path === '/api/projects/project-1') {
        return Promise.resolve({
          project: { name: 'QA Project', currentUserRole: 'project_manager' },
        });
      }

      if (path.startsWith('/api/reports/diary?')) {
        return Promise.resolve(buildDiaryReport());
      }

      return Promise.reject(new Error(`Unexpected API path: ${path}`));
    });
  }

  it('normalizes the company tier before gating scheduled reports', async () => {
    mockCompanyAndDiary(' Professional ');

    renderReportsPage();
    expect(await screen.findByText('Total Diaries')).toBeInTheDocument();

    const scheduleButton = screen.getByRole('button', { name: 'Schedule Reports' });
    await waitFor(() => expect(scheduleButton).toBeEnabled());
    fireEvent.click(scheduleButton);

    expect(await screen.findByTestId('schedule-report-modal')).toBeInTheDocument();
    expect(
      screen.queryByText(/require a Professional or Enterprise subscription/i),
    ).not.toBeInTheDocument();
  });

  it('shows the upgrade prompt instead of the schedule modal on the basic tier', async () => {
    mockCompanyAndDiary('basic');

    renderReportsPage();
    expect(await screen.findByText('Total Diaries')).toBeInTheDocument();

    const scheduleButton = screen.getByRole('button', { name: 'Schedule Reports' });
    await waitFor(() => expect(scheduleButton).toBeEnabled());
    fireEvent.click(scheduleButton);

    expect(
      await screen.findByText(/require a Professional or Enterprise subscription/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('schedule-report-modal')).not.toBeInTheDocument();
  });

  it('redirects the legacy advanced tab URL to lot status', async () => {
    apiFetchMock.mockImplementation((path) => {
      if (path === '/api/company') {
        return Promise.resolve({
          company: { subscriptionTier: 'basic', name: 'QA Company', logoUrl: null },
        });
      }

      if (path === '/api/projects/project-1') {
        return Promise.resolve({
          project: { name: 'QA Project', currentUserRole: 'project_manager' },
        });
      }

      if (path.startsWith('/api/reports/lot-status?')) {
        return Promise.resolve(buildLotStatusReport());
      }

      return Promise.reject(new Error(`Unexpected API path: ${path}`));
    });

    renderReportsPage('/projects/project-1/reports?tab=advanced');

    expect(await screen.findByRole('tab', { name: 'Lot Status', selected: true })).toBeVisible();
    expect(screen.queryByRole('tab', { name: /Advanced Analytics/i })).not.toBeInTheDocument();
  });
});

describe('ReportsPage paginated report loading', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('loads every page before rendering a paginated lot status report', async () => {
    const baseLot = buildLotStatusReport().lots[0]!;
    const firstPage: LotStatusReport = {
      ...buildLotStatusReport(),
      totalLots: 2,
      lots: [
        {
          ...baseLot,
          id: 'lot-page-1',
          lotNumber: 'LOT-PAGE-001',
        },
      ],
      pagination: { page: 1, limit: 500, total: 2, totalPages: 2 },
    };
    const secondPage: LotStatusReport = {
      ...firstPage,
      lots: [
        {
          ...baseLot,
          id: 'lot-page-2',
          lotNumber: 'LOT-PAGE-002',
        },
      ],
      pagination: { page: 2, limit: 500, total: 2, totalPages: 2 },
    };

    apiFetchMock.mockImplementation((path) => {
      if (path === '/api/company') {
        return Promise.resolve({
          company: { subscriptionTier: 'professional', name: 'QA Company', logoUrl: null },
        });
      }

      if (path === '/api/projects/project-1') {
        return Promise.resolve({
          project: { name: 'QA Project', currentUserRole: 'project_manager' },
        });
      }

      if (path.startsWith('/api/reports/lot-status?')) {
        const requestUrl = new URL(path, 'https://siteproof.test');
        const page = requestUrl.searchParams.get('page');
        expect(requestUrl.searchParams.get('limit')).toBe('500');
        return Promise.resolve(page === '2' ? secondPage : firstPage);
      }

      return Promise.reject(new Error(`Unexpected API path: ${path}`));
    });

    renderReportsPage('/projects/project-1/reports?tab=lot-status');

    expect(await screen.findByText('LOT-PAGE-001')).toBeInTheDocument();
    expect(await screen.findByText('LOT-PAGE-002')).toBeInTheDocument();
    expect(screen.queryByText(/Showing first/i)).not.toBeInTheDocument();
  });
});

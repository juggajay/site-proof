import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DateFormatProvider } from '@/lib/dateFormat';
import { TimezoneProvider } from '@/lib/timezone';
import { ClaimsReportTab } from './ClaimsReportTab';
import { DiaryReportTab } from './DiaryReportTab';
import { LotStatusTab } from './LotStatusTab';
import { TestResultsTab } from './TestResultsTab';
import type { ClaimsReport, DiaryReport, LotStatusReport, TestReport } from '../types';

function renderWithDateProviders(children: React.ReactNode) {
  return render(
    <DateFormatProvider>
      <TimezoneProvider>{children}</TimezoneProvider>
    </DateFormatProvider>,
  );
}

function testReport(overrides: Partial<TestReport> = {}): TestReport {
  return {
    generatedAt: '2026-06-28T01:00:00.000Z',
    projectId: 'project-1',
    totalTests: 250,
    passFailCounts: { pass: 1 },
    testTypeCounts: { Compaction: 1 },
    statusCounts: { verified: 1 },
    tests: [
      {
        id: 'test-1',
        testRequestNumber: 'TR-001',
        testType: 'Compaction',
        laboratoryName: 'Lab Co',
        laboratoryReportNumber: 'LAB-001',
        sampleDate: null,
        resultDate: null,
        resultValue: 98,
        resultUnit: '%',
        specificationMin: null,
        specificationMax: null,
        passFail: 'pass',
        status: 'verified',
        lotId: 'lot-1',
      },
    ],
    summary: { pass: 1, fail: 0, pending: 0, passRate: '100.0' },
    pagination: { page: 1, limit: 100, total: 250, totalPages: 3 },
    ...overrides,
  };
}

function diaryReport(overrides: Partial<DiaryReport> = {}): DiaryReport {
  return {
    generatedAt: '2026-06-28T01:00:00.000Z',
    projectId: 'project-1',
    dateRange: { startDate: null, endDate: null },
    selectedSections: ['weather', 'personnel', 'plant', 'activities', 'delays'],
    totalDiaries: 120,
    submittedCount: 1,
    draftCount: 0,
    diaries: [
      {
        id: 'diary-1',
        date: '2026-06-27T00:00:00.000Z',
        status: 'submitted',
        isLate: false,
        weatherConditions: 'Fine',
        personnel: [],
        plant: [],
        activities: [],
        delays: [],
      },
    ],
    summary: {
      weather: { Fine: 1 },
      personnel: { totalPersonnel: 0, totalHours: 0, byCompany: {} },
      plant: { totalPlant: 0, totalHours: 0, byCompany: {} },
      activities: { totalActivities: 0, byLot: {} },
      delays: { totalDelays: 0, totalHours: 0, byType: {} },
    },
    pagination: { page: 1, limit: 100, total: 120, totalPages: 2 },
    ...overrides,
  };
}

function lotStatusReport(overrides: Partial<LotStatusReport> = {}): LotStatusReport {
  return {
    generatedAt: '2026-06-28T01:00:00.000Z',
    projectId: 'project-1',
    totalLots: 0,
    statusCounts: {},
    activityCounts: {},
    lots: [],
    summary: {
      notStarted: 0,
      inProgress: 0,
      awaitingTest: 0,
      holdPoint: 0,
      ncrRaised: 0,
      conformed: 0,
      claimed: 0,
    },
    ...overrides,
  };
}

function claimsReport(overrides: Partial<ClaimsReport> = {}): ClaimsReport {
  return {
    generatedAt: '2026-06-28T01:00:00.000Z',
    projectId: 'project-1',
    dateRange: { startDate: null, endDate: null },
    totalClaims: 0,
    statusCounts: {},
    financialSummary: {
      totalClaimed: 0,
      totalCertified: 0,
      totalPaid: 0,
      outstanding: 0,
      certificationRate: '0.0',
      collectionRate: '0.0',
      totalLots: 0,
    },
    monthlyBreakdown: [],
    claims: [],
    ...overrides,
  };
}

describe('report detail pagination captions', () => {
  it('warns when the test details table is showing a truncated first page', () => {
    renderWithDateProviders(
      <TestResultsTab report={testReport()} loading={false} onRefresh={vi.fn()} />,
    );

    expect(screen.getByText('Showing first 1 of 250 test results.')).toBeInTheDocument();
  });

  it('warns when the diary details table is showing a truncated first page', () => {
    renderWithDateProviders(
      <DiaryReportTab report={diaryReport()} loading={false} onGenerateReport={vi.fn()} />,
    );

    expect(screen.getByText('Showing first 1 of 120 diary entries.')).toBeInTheDocument();
  });
});

describe('report table empty states and actions', () => {
  it('shows an empty state for lot status details with no rows', () => {
    renderWithDateProviders(<LotStatusTab report={lotStatusReport()} />);

    expect(screen.getByText('No lots found for this project.')).toBeInTheDocument();
  });

  it('shows an empty state for claim details with no rows', () => {
    renderWithDateProviders(
      <ClaimsReportTab report={claimsReport()} loading={false} onGenerateReport={vi.fn()} />,
    );

    expect(screen.getByText('No claims found for the selected criteria.')).toBeInTheDocument();
  });

  it('leaves printing to the shared ReportsPage action on the test results tab', () => {
    renderWithDateProviders(
      <TestResultsTab report={testReport()} loading={false} onRefresh={vi.fn()} />,
    );

    expect(screen.queryByRole('button', { name: 'Print / Save PDF' })).not.toBeInTheDocument();
  });
});

describe('report date range validation', () => {
  it('blocks test report generation when the start date is after the end date', () => {
    const onRefresh = vi.fn();
    renderWithDateProviders(<TestResultsTab report={null} loading={false} onRefresh={onRefresh} />);

    fireEvent.change(screen.getByLabelText('Test report start date'), {
      target: { value: '2026-06-30' },
    });
    fireEvent.change(screen.getByLabelText('Test report end date'), {
      target: { value: '2026-06-01' },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Start date must be on or before end date.',
    );
    expect(screen.getByRole('button', { name: 'Generate Report' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Generate Report' }));
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('blocks diary report generation when the start date is after the end date', () => {
    const onGenerateReport = vi.fn();
    renderWithDateProviders(
      <DiaryReportTab report={null} loading={false} onGenerateReport={onGenerateReport} />,
    );

    fireEvent.change(screen.getByLabelText('Diary report start date'), {
      target: { value: '2026-06-30' },
    });
    fireEvent.change(screen.getByLabelText('Diary report end date'), {
      target: { value: '2026-06-01' },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Start date must be on or before end date.',
    );
    expect(screen.getByRole('button', { name: 'Generate Report' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Generate Report' }));
    expect(onGenerateReport).not.toHaveBeenCalled();
  });

  it('blocks claims report generation when the start date is after the end date', () => {
    const onGenerateReport = vi.fn();
    renderWithDateProviders(
      <ClaimsReportTab report={null} loading={false} onGenerateReport={onGenerateReport} />,
    );

    fireEvent.change(screen.getByLabelText('Claim report start date'), {
      target: { value: '2026-06-30' },
    });
    fireEvent.change(screen.getByLabelText('Claim report end date'), {
      target: { value: '2026-06-01' },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Start date must be on or before end date.',
    );
    expect(screen.getByRole('button', { name: 'Generate Report' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Generate Report' }));
    expect(onGenerateReport).not.toHaveBeenCalled();
  });
});

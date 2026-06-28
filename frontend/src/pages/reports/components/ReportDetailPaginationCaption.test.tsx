import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DateFormatProvider } from '@/lib/dateFormat';
import { TimezoneProvider } from '@/lib/timezone';
import { DiaryReportTab } from './DiaryReportTab';
import { TestResultsTab } from './TestResultsTab';
import type { DiaryReport, TestReport } from '../types';

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

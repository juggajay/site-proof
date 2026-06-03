import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// The path builders and normalizers are pure and need no mocks. The hook reaches
// the network through apiFetch and logs through logError; mock only those
// boundaries. apiFetch is stubbed via a partial mock so the module's other
// exports (e.g. ApiError) keep their real implementations.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});
vi.mock('@/lib/logger', () => ({ devLog: vi.fn(), devWarn: vi.fn(), logError: vi.fn() }));

import { apiFetch } from '@/lib/api';
import { logError } from '@/lib/logger';
import {
  buildConformanceStatusPath,
  buildLotHistoryPath,
  buildLotNcrsPath,
  buildLotTestResultsPath,
  buildQualityAccessPath,
  normalizeActivityLogs,
  normalizeNcrs,
  normalizeTestResults,
  useLotQualityAccessQuery,
} from './lotDetailData';
import type { ActivityLog, NCR, QualityAccess, TestResult } from './types';

const apiFetchMock = vi.mocked(apiFetch);

describe('buildQualityAccessPath', () => {
  it('builds the check-role path for a project', () => {
    expect(buildQualityAccessPath('project-1')).toBe('/api/lots/check-role/project-1');
  });

  it('encodes the project id', () => {
    expect(buildQualityAccessPath('a/b c')).toBe('/api/lots/check-role/a%2Fb%20c');
  });
});

describe('buildConformanceStatusPath', () => {
  it('builds the conform-status path for a lot', () => {
    expect(buildConformanceStatusPath('lot-1')).toBe('/api/lots/lot-1/conform-status');
  });

  it('encodes the lot id', () => {
    expect(buildConformanceStatusPath('a/b')).toBe('/api/lots/a%2Fb/conform-status');
  });
});

describe('buildLotTestResultsPath', () => {
  it('builds the project+lot scoped test-results query path', () => {
    expect(buildLotTestResultsPath('p1', 'l1')).toBe('/api/test-results?projectId=p1&lotId=l1');
  });

  it('encodes both ids', () => {
    expect(buildLotTestResultsPath('p 1', 'l/2')).toBe(
      '/api/test-results?projectId=p%201&lotId=l%2F2',
    );
  });
});

describe('buildLotNcrsPath', () => {
  it('builds the project+lot scoped ncrs query path', () => {
    expect(buildLotNcrsPath('p1', 'l1')).toBe('/api/ncrs?projectId=p1&lotId=l1');
  });

  it('encodes both ids', () => {
    expect(buildLotNcrsPath('p 1', 'l/2')).toBe('/api/ncrs?projectId=p%201&lotId=l%2F2');
  });
});

describe('buildLotHistoryPath', () => {
  it('builds the audit-logs path scoped to a lot', () => {
    expect(buildLotHistoryPath('lot-1')).toBe(
      '/api/audit-logs?entityType=Lot&search=lot-1&limit=100',
    );
  });

  it('encodes the lot id used as the search term', () => {
    expect(buildLotHistoryPath('a/b c')).toBe(
      '/api/audit-logs?entityType=Lot&search=a%2Fb%20c&limit=100',
    );
  });
});

const testResultFixture: TestResult = {
  id: 'tr-1',
  testType: 'Compaction',
  testRequestNumber: 'TRN-1',
  laboratoryName: 'Lab',
  resultValue: 95,
  resultUnit: '%',
  passFail: 'pass',
  status: 'verified',
  createdAt: '2026-05-30T00:00:00.000Z',
};

const ncrFixture: NCR = {
  id: 'ncr-1',
  ncrNumber: 'NCR-001',
  description: 'Issue',
  category: 'quality',
  severity: 'minor',
  status: 'open',
  raisedBy: { fullName: 'Jane', email: 'jane@example.com' },
  createdAt: '2026-05-30T00:00:00.000Z',
};

const activityLogFixture: ActivityLog = {
  id: 'log-1',
  action: 'lot.updated',
  entityType: 'Lot',
  entityId: 'lot-1',
  changes: null,
  createdAt: '2026-05-30T00:00:00.000Z',
  user: { id: 'u1', email: 'jane@example.com', fullName: 'Jane' },
};

describe('normalizeTestResults', () => {
  it('returns the test results array when present', () => {
    expect(normalizeTestResults({ testResults: [testResultFixture] })).toEqual([testResultFixture]);
  });

  it('returns an empty array when the field is missing or undefined', () => {
    expect(normalizeTestResults({})).toEqual([]);
    expect(normalizeTestResults({ testResults: undefined })).toEqual([]);
  });
});

describe('normalizeNcrs', () => {
  it('returns the ncrs array when present', () => {
    expect(normalizeNcrs({ ncrs: [ncrFixture] })).toEqual([ncrFixture]);
  });

  it('returns an empty array when the field is missing or undefined', () => {
    expect(normalizeNcrs({})).toEqual([]);
    expect(normalizeNcrs({ ncrs: undefined })).toEqual([]);
  });
});

describe('normalizeActivityLogs', () => {
  it('returns the logs array when present', () => {
    expect(normalizeActivityLogs({ logs: [activityLogFixture] })).toEqual([activityLogFixture]);
  });

  it('returns an empty array when the field is missing or undefined', () => {
    expect(normalizeActivityLogs({})).toEqual([]);
    expect(normalizeActivityLogs({ logs: undefined })).toEqual([]);
  });
});

const qualityAccessFixture: QualityAccess = {
  role: 'admin',
  isQualityManager: true,
  canConformLots: true,
  canVerifyTestResults: true,
  canCloseNCRs: true,
  canManageITPTemplates: true,
};

// A fresh client per render so cache never leaks between tests. retry is left
// enabled at the client level so the hook's own `retry: false` is what we verify.
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 3, retryDelay: 0 } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useLotQualityAccessQuery', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetches the check-role endpoint for the project and returns the data', async () => {
    apiFetchMock.mockResolvedValueOnce(qualityAccessFixture);

    const { result } = renderHook(() => useLotQualityAccessQuery('project-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith('/api/lots/check-role/project-1');
    expect(result.current.data).toEqual(qualityAccessFixture);
  });

  it('does not fetch when no project id is provided', () => {
    renderHook(() => useLotQualityAccessQuery(undefined), { wrapper: createWrapper() });
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('logs and does not retry on failure (leaving data undefined)', async () => {
    apiFetchMock.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useLotQualityAccessQuery('project-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith('Failed to fetch quality access:', expect.any(Error));
    expect(result.current.data).toBeUndefined();
  });
});

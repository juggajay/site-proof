import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});
vi.mock('@/lib/logger', () => ({ logError: vi.fn(), devLog: vi.fn(), devWarn: vi.fn() }));

import { apiFetch } from '@/lib/api';
import { useLotTabData } from './useLotTabData';
import type { ActivityLog, LotTab, NCR, TestResult } from '../types';

const apiFetchMock = vi.mocked(apiFetch);

const testResultFixture: TestResult = {
  id: 'test-1',
  testType: 'compaction',
  testRequestNumber: 'TR-001',
  laboratoryName: 'Lab',
  resultValue: 96,
  resultUnit: '%',
  passFail: 'pass',
  status: 'verified',
  createdAt: '2026-06-06T00:00:00.000Z',
};

const ncrFixture: NCR = {
  id: 'ncr-1',
  ncrNumber: 'NCR-001',
  description: 'Open issue',
  category: 'quality',
  severity: 'minor',
  status: 'open',
  raisedBy: { fullName: 'QA', email: 'qa@example.com' },
  createdAt: '2026-06-06T00:00:00.000Z',
};

const historyFixture: ActivityLog = {
  id: 'log-1',
  action: 'lot_status_changed',
  entityType: 'Lot',
  entityId: 'lot-1',
  changes: null,
  createdAt: '2026-06-06T00:00:00.000Z',
  user: { id: 'u1', email: 'qa@example.com', fullName: 'QA' },
};

function mockLotTabEndpoints() {
  apiFetchMock.mockImplementation(async (path) => {
    if (path === '/api/test-results?projectId=project-1&lotId=lot-1') {
      return { testResults: [testResultFixture] };
    }
    if (path === '/api/ncrs?projectId=project-1&lotId=lot-1') {
      return { ncrs: [ncrFixture] };
    }
    if (path === '/api/audit-logs?entityType=Lot&search=lot-1&limit=100') {
      return { logs: [historyFixture] };
    }
    throw new Error(`Unexpected apiFetch path: ${path}`);
  });
}

function renderTabData(currentTab: LotTab) {
  return renderHook(
    (tab: LotTab) => useLotTabData({ projectId: 'project-1', lotId: 'lot-1', currentTab: tab }),
    { initialProps: currentTab },
  );
}

describe('useLotTabData', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loads tab badge counts without loading tab contents', async () => {
    mockLotTabEndpoints();

    const { result } = renderTabData('itp');

    await waitFor(() => {
      expect(result.current.testsCount).toBe(1);
      expect(result.current.ncrsCount).toBe(1);
    });

    expect(result.current.testResults).toEqual([]);
    expect(result.current.ncrs).toEqual([]);
    expect(result.current.activityLogs).toEqual([]);
    expect(apiFetchMock).toHaveBeenCalledWith('/api/test-results?projectId=project-1&lotId=lot-1');
    expect(apiFetchMock).toHaveBeenCalledWith('/api/ncrs?projectId=project-1&lotId=lot-1');
  });

  it('loads test results when the tests tab is selected', async () => {
    mockLotTabEndpoints();

    const { result } = renderTabData('tests');

    await waitFor(() => expect(result.current.testResults).toEqual([testResultFixture]));
    expect(result.current.loadingTests).toBe(false);
    expect(result.current.testsCount).toBe(1);
  });

  it('loads NCRs when the NCR tab is selected', async () => {
    mockLotTabEndpoints();

    const { result } = renderTabData('ncrs');

    await waitFor(() => expect(result.current.ncrs).toEqual([ncrFixture]));
    expect(result.current.loadingNcrs).toBe(false);
    expect(result.current.ncrsCount).toBe(1);
  });

  it('loads activity history when the history tab is selected', async () => {
    mockLotTabEndpoints();

    const { result } = renderTabData('history');

    await waitFor(() => expect(result.current.activityLogs).toEqual([historyFixture]));
    expect(result.current.loadingHistory).toBe(false);
  });

  it('clears stale activity history when refresh fails', async () => {
    mockLotTabEndpoints();

    const { result } = renderTabData('history');

    await waitFor(() => expect(result.current.activityLogs).toEqual([historyFixture]));

    apiFetchMock.mockRejectedValueOnce(new Error('history failed'));
    await act(async () => {
      await result.current.refreshActivityHistory();
    });

    await waitFor(() => expect(result.current.activityLogs).toEqual([]));
  });

  it('does not fetch when project or lot id is missing', () => {
    renderHook(() => useLotTabData({ projectId: undefined, lotId: 'lot-1', currentTab: 'tests' }));
    renderHook(() =>
      useLotTabData({ projectId: 'project-1', lotId: undefined, currentTab: 'tests' }),
    );

    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});

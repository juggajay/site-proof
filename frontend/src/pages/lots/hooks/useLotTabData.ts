import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { logError } from '@/lib/logger';
import {
  buildLotHistoryPath,
  buildLotNcrsPath,
  buildLotTestResultsPath,
  normalizeActivityLogs,
  normalizeNcrs,
  normalizeTestResults,
} from '../lotDetailData';
import type { ActivityLog, LotTab, NCR, TestResult } from '../types';

type UseLotTabDataParams = {
  projectId: string | undefined;
  lotId: string | undefined;
  currentTab: LotTab;
};

export function useLotTabData({ projectId, lotId, currentTab }: UseLotTabDataParams) {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [loadingTests, setLoadingTests] = useState(false);
  const [ncrs, setNcrs] = useState<NCR[]>([]);
  const [loadingNcrs, setLoadingNcrs] = useState(false);
  const [testsCount, setTestsCount] = useState<number | null>(null);
  const [ncrsCount, setNcrsCount] = useState<number | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    async function fetchTabCounts() {
      if (!projectId || !lotId) return;

      try {
        const testsData = await apiFetch<{ testResults: TestResult[] }>(
          buildLotTestResultsPath(projectId, lotId),
        );
        setTestsCount(normalizeTestResults(testsData).length);
      } catch (err) {
        logError('Failed to fetch tests count:', err);
      }

      try {
        const ncrsData = await apiFetch<{ ncrs: NCR[] }>(buildLotNcrsPath(projectId, lotId));
        setNcrsCount(normalizeNcrs(ncrsData).length);
      } catch (err) {
        logError('Failed to fetch NCRs count:', err);
      }
    }

    void fetchTabCounts();
  }, [projectId, lotId]);

  useEffect(() => {
    async function fetchTestResults() {
      if (!projectId || !lotId || currentTab !== 'tests') return;

      setLoadingTests(true);

      try {
        const data = await apiFetch<{ testResults: TestResult[] }>(
          buildLotTestResultsPath(projectId, lotId),
        );
        const results = normalizeTestResults(data);
        setTestResults(results);
        setTestsCount(results.length);
      } catch (err) {
        logError('Failed to fetch test results:', err);
      } finally {
        setLoadingTests(false);
      }
    }

    void fetchTestResults();
  }, [projectId, lotId, currentTab]);

  const refreshTests = useCallback(async () => {
    try {
      const data = await apiFetch<{ testResults: TestResult[] }>(
        buildLotTestResultsPath(projectId || '', lotId || ''),
      );
      const list = normalizeTestResults(data);
      setTestResults(list);
      setTestsCount(list.length);
    } catch {
      /* ignore */
    }
  }, [projectId, lotId]);

  const refreshNcrsAfterFailure = useCallback(async () => {
    try {
      const ncrsData = await apiFetch<{ ncrs: NCR[] }>(
        buildLotNcrsPath(projectId || '', lotId || ''),
      );
      const ncrList = normalizeNcrs(ncrsData);
      setNcrs(ncrList);
      setNcrsCount(ncrList.length);
    } catch {
      /* ignore */
    }
  }, [projectId, lotId]);

  useEffect(() => {
    async function fetchNcrs() {
      if (!projectId || !lotId || currentTab !== 'ncrs') return;

      setLoadingNcrs(true);

      try {
        const data = await apiFetch<{ ncrs: NCR[] }>(buildLotNcrsPath(projectId, lotId));
        const ncrList = normalizeNcrs(data);
        setNcrs(ncrList);
        setNcrsCount(ncrList.length);
      } catch (err) {
        logError('Failed to fetch NCRs:', err);
      } finally {
        setLoadingNcrs(false);
      }
    }

    void fetchNcrs();
  }, [projectId, lotId, currentTab]);

  const refreshActivityHistory = useCallback(async () => {
    if (!lotId) {
      setActivityLogs([]);
      return;
    }

    setLoadingHistory(true);
    try {
      setActivityLogs([]);
      const data = await apiFetch<{ logs: ActivityLog[] }>(buildLotHistoryPath(lotId));
      setActivityLogs(normalizeActivityLogs(data));
    } catch (err) {
      setActivityLogs([]);
      logError('Failed to fetch activity history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [lotId]);

  useEffect(() => {
    if (currentTab !== 'history') return;
    void refreshActivityHistory();
  }, [currentTab, refreshActivityHistory]);

  return {
    testResults,
    loadingTests,
    ncrs,
    loadingNcrs,
    testsCount,
    ncrsCount,
    activityLogs,
    loadingHistory,
    refreshNcrsAfterFailure,
    refreshActivityHistory,
    refreshTests,
  };
}

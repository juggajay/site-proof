/**
 * PR-L: Mobile header collapse + EnterResults sheet integration tests.
 *
 * Coverage:
 *  - Mobile: only "Add Test Result" + More button visible in header
 *  - Mobile: More sheet opens and contains all secondary actions
 *  - Mobile: each secondary action fires the correct handler (Export CSV, Upload Certificate, Batch Upload)
 *  - Desktop: all four header buttons are rendered directly (unchanged)
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TestResultsPage } from './TestResultsPage';
import { queryKeys } from '@/lib/queryKeys';

// ── useIsMobile control ──
const useIsMobileMock = vi.hoisted(() => vi.fn(() => false));

vi.mock('@/hooks/useMediaQuery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useMediaQuery')>();
  return { ...actual, useIsMobile: useIsMobileMock };
});

// ── Stub BottomSheet ──
vi.mock('@/components/foreman/sheets/BottomSheet', () => ({
  BottomSheet: ({
    isOpen,
    title,
    children,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
  }) =>
    isOpen ? (
      <div data-testid="bottom-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <button data-testid="bottom-sheet-close" onClick={onClose}>
          close
        </button>
        {children}
      </div>
    ) : null,
}));

// ── Stub heavy modals so we don't need their full dependency graphs ──
vi.mock('./components/CreateTestModal', () => ({
  CreateTestModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? (
      <div role="dialog" aria-label="Add Test Result">
        create-test-modal-stub
      </div>
    ) : null,
}));

vi.mock('./components/EnterResultsModal', () => ({
  EnterResultsModal: () => null,
}));

vi.mock('./components/UploadCertificateModal', () => ({
  UploadCertificateModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? (
      <div role="dialog" aria-label="Upload Certificate">
        upload-modal-stub
      </div>
    ) : null,
}));

vi.mock('./components/BatchUploadModal', () => ({
  BatchUploadModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? (
      <div role="dialog" aria-label="Batch Upload">
        batch-upload-modal-stub
      </div>
    ) : null,
}));

vi.mock('./components/RejectTestModal', () => ({ RejectTestModal: () => null }));
vi.mock('./components/NcrModals', () => ({
  NcrPromptModal: () => null,
  NcrCreateModal: () => null,
}));

// ── Stub table / mobile list so they don't need DOM table environment ──
vi.mock('./components/TestResultsTable', () => ({
  TestResultsTable: ({
    onUpdateStatus,
    filteredTestResults,
    highlightedTestId,
  }: {
    onUpdateStatus: (testId: string, newStatus: string) => Promise<void>;
    filteredTestResults: Array<{ id: string }>;
    highlightedTestId?: string | null;
  }) => (
    <div
      data-testid="test-results-table"
      data-row-count={filteredTestResults.length}
      data-highlighted={highlightedTestId ?? ''}
    >
      <button type="button" onClick={() => void onUpdateStatus('t1', 'verified')}>
        Verify density
      </button>
    </div>
  ),
}));

vi.mock('./components/TestResultsMobileList', () => ({
  TestResultsMobileList: () => <div data-testid="test-results-mobile-list" />,
}));

vi.mock('./components/TestFilters', () => ({
  TestFilters: () => <div data-testid="test-filters" />,
}));

// ── Stub ContextHelp ──
vi.mock('@/components/ContextHelp', () => ({
  ContextHelp: () => null,
  HELP_CONTENT: { tests: { title: '', content: '' } },
}));

// ── Stub downloadCsv ──
const downloadCsvMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/csv', () => ({ downloadCsv: downloadCsvMock }));

// ── Stub apiFetch so no real network calls happen ──
const apiFetchMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ testResults: [], lots: [], project: { state: 'NSW' } }),
);
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: apiFetchMock };
});
vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return { ...actual, getAuthToken: () => 'test-token' };
});

const PROJECT_ID = 'proj-e2e-001';
let queryClient: QueryClient;
let invalidateSpy: ReturnType<typeof vi.spyOn>;

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/projects/${PROJECT_ID}/tests`]}>
        <Routes>
          <Route path="/projects/:projectId/tests" element={<TestResultsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function waitForPageLoad() {
  // Page shows spinner while loading; wait for heading
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Test Results' })).toBeInTheDocument();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient();
  invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
});

describe('TestResultsPage header — desktop (unchanged)', () => {
  beforeEach(() => {
    useIsMobileMock.mockReturnValue(false);
    apiFetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/test-results'))
        return Promise.resolve({
          testResults: [
            {
              id: 't1',
              testType: 'Density',
              status: 'entered',
              passFail: 'pass',
              resultValue: 98,
              resultUnit: '%',
              specificationMin: 95,
              specificationMax: 100,
              lotId: 'lot-1',
              lot: { id: 'lot-1', lotNumber: 'L-001' },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        });
      if (url.includes('/api/lots')) return Promise.resolve({ lots: [] });
      if (url.includes('/api/projects/'))
        return Promise.resolve({ project: { id: PROJECT_ID, state: 'NSW' } });
      return Promise.resolve({});
    });
  });

  it('renders all four header buttons directly on desktop', async () => {
    renderPage();
    await waitForPageLoad();

    expect(screen.getByRole('button', { name: 'Add Test Result' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Upload Certificate/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Batch Upload/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export CSV/i })).toBeInTheDocument();

    // No overflow button on desktop
    expect(screen.queryByTestId('tests-header-more-button')).not.toBeInTheDocument();
  });

  it('invalidates readiness and lot caches after a test-result status mutation', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForPageLoad();

    await user.click(screen.getByRole('button', { name: 'Verify density' }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/test-results/t1/status', {
        method: 'POST',
        body: JSON.stringify({ status: 'verified' }),
      });
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.testResults(PROJECT_ID) });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.lots(PROJECT_ID) });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.claimReadiness(PROJECT_ID) });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.lot('lot-1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.lotReadiness('lot-1') });
  });
});

describe('TestResultsPage header — mobile', () => {
  beforeEach(() => {
    useIsMobileMock.mockReturnValue(true);
    apiFetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/test-results'))
        return Promise.resolve({
          testResults: [
            {
              id: 't1',
              testType: 'Density',
              status: 'entered',
              passFail: 'pass',
              resultValue: 98,
              resultUnit: '%',
              specificationMin: 95,
              specificationMax: 100,
              lotId: null,
              lot: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        });
      if (url.includes('/api/lots')) return Promise.resolve({ lots: [] });
      if (url.includes('/api/projects/'))
        return Promise.resolve({ project: { id: PROJECT_ID, state: 'NSW' } });
      return Promise.resolve({});
    });
  });

  it('shows "Upload Certificate" primary button and "More" overflow button on mobile, hiding secondary buttons', async () => {
    renderPage();
    await waitForPageLoad();

    // Cert-first: Upload Certificate is the mobile primary action
    expect(screen.getByRole('button', { name: /Upload Certificate/i })).toBeInTheDocument();
    expect(screen.getByTestId('tests-header-more-button')).toBeInTheDocument();

    // Secondary actions are NOT directly in the header (they live in the overflow sheet)
    expect(screen.queryByRole('button', { name: 'Add Test Result' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Batch Upload/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Export CSV/i })).not.toBeInTheDocument();
  });

  it('opens the overflow BottomSheet when More button is clicked', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForPageLoad();

    await user.click(screen.getByTestId('tests-header-more-button'));

    await waitFor(() => {
      expect(screen.getByTestId('bottom-sheet')).toBeInTheDocument();
    });
    // Sheet is labelled "More actions"
    expect(screen.getByRole('dialog', { name: 'More actions' })).toBeInTheDocument();
    // Secondary actions appear as rows in the sheet (Upload Certificate is now the primary)
    expect(screen.getByRole('button', { name: /Export CSV/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Test Result' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Batch Upload/i })).toBeInTheDocument();
  });

  it('fires Export CSV handler from the overflow sheet and closes the sheet', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForPageLoad();

    await user.click(screen.getByTestId('tests-header-more-button'));
    await waitFor(() => screen.getByTestId('bottom-sheet'));

    await user.click(screen.getByRole('button', { name: /Export CSV/i }));

    await waitFor(() => {
      expect(downloadCsvMock).toHaveBeenCalledOnce();
    });
    // Sheet closes after action
    await waitFor(() => {
      expect(screen.queryByTestId('bottom-sheet')).not.toBeInTheDocument();
    });
  });

  it('opens UploadCertificateModal from the primary header button', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForPageLoad();

    await user.click(screen.getByRole('button', { name: /Upload Certificate/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Upload Certificate' })).toBeInTheDocument();
    });
  });

  it('opens BatchUploadModal from the overflow sheet', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForPageLoad();

    await user.click(screen.getByTestId('tests-header-more-button'));
    await waitFor(() => screen.getByTestId('bottom-sheet'));

    await user.click(screen.getByRole('button', { name: /Batch Upload/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Batch Upload' })).toBeInTheDocument();
    });
  });

  it('opens CreateTestModal from the "Add Test Result" row in the overflow sheet on mobile', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForPageLoad();

    await user.click(screen.getByTestId('tests-header-more-button'));
    await waitFor(() => screen.getByTestId('bottom-sheet'));

    await user.click(screen.getByRole('button', { name: 'Add Test Result' }));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Add Test Result' })).toBeInTheDocument();
    });
  });
});

describe('TestResultsPage register — full pagination + deep link', () => {
  beforeEach(() => {
    useIsMobileMock.mockReturnValue(false);
  });

  function makeTest(id: string) {
    return {
      id,
      testType: 'Density',
      status: 'entered',
      passFail: 'pass',
      resultValue: 98,
      resultUnit: '%',
      specificationMin: 95,
      specificationMax: 100,
      lotId: null,
      lot: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  it('aggregates every page of test results instead of only the first', async () => {
    apiFetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/test-results')) {
        const page = new URL(`http://x/${url}`).searchParams.get('page');
        if (page === '1') {
          return Promise.resolve({
            testResults: [makeTest('t1'), makeTest('t2')],
            pagination: { hasNextPage: true, totalPages: 2 },
          });
        }
        return Promise.resolve({
          testResults: [makeTest('t3')],
          pagination: { hasNextPage: false, totalPages: 2 },
        });
      }
      if (url.includes('/api/lots')) return Promise.resolve({ lots: [] });
      if (url.includes('/api/projects/'))
        return Promise.resolve({ project: { id: PROJECT_ID, state: 'NSW' } });
      return Promise.resolve({});
    });

    renderPage();
    await waitForPageLoad();

    // Both pages requested, and all three rows reach the table (not just page 1).
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(expect.stringContaining('page=2'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('test-results-table')).toHaveAttribute('data-row-count', '3');
    });
  });

  it('highlights the deep-linked test from ?test=<id>', async () => {
    apiFetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/test-results'))
        return Promise.resolve({
          testResults: [makeTest('t1'), makeTest('t2')],
          pagination: { hasNextPage: false, totalPages: 1 },
        });
      if (url.includes('/api/lots')) return Promise.resolve({ lots: [] });
      if (url.includes('/api/projects/'))
        return Promise.resolve({ project: { id: PROJECT_ID, state: 'NSW' } });
      return Promise.resolve({});
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/projects/${PROJECT_ID}/tests?test=t2`]}>
          <Routes>
            <Route path="/projects/:projectId/tests" element={<TestResultsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitForPageLoad();

    await waitFor(() => {
      expect(screen.getByTestId('test-results-table')).toHaveAttribute('data-highlighted', 't2');
    });
  });
});

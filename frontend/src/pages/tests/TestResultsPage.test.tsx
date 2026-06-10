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
import { TestResultsPage } from './TestResultsPage';

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
  TestResultsTable: () => <div data-testid="test-results-table" />,
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

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/projects/${PROJECT_ID}/tests`]}>
      <Routes>
        <Route path="/projects/:projectId/tests" element={<TestResultsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function waitForPageLoad() {
  // Page shows spinner while loading; wait for heading
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Test Results' })).toBeInTheDocument();
  });
}

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

  it('shows "Add Test Result" primary button and "More" overflow button on mobile, hiding secondary buttons', async () => {
    renderPage();
    await waitForPageLoad();

    expect(screen.getByRole('button', { name: 'Add Test Result' })).toBeInTheDocument();
    expect(screen.getByTestId('tests-header-more-button')).toBeInTheDocument();

    // Secondary buttons are NOT directly in the header
    expect(screen.queryByRole('button', { name: /Upload Certificate/i })).not.toBeInTheDocument();
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
    // All three secondary actions appear as rows in the sheet
    expect(screen.getByRole('button', { name: /Export CSV/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Upload Certificate/i })).toBeInTheDocument();
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

  it('opens UploadCertificateModal from the overflow sheet', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForPageLoad();

    await user.click(screen.getByTestId('tests-header-more-button'));
    await waitFor(() => screen.getByTestId('bottom-sheet'));

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

  it('opens CreateTestModal when primary "Add Test Result" is clicked on mobile', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForPageLoad();

    await user.click(screen.getByRole('button', { name: 'Add Test Result' }));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Add Test Result' })).toBeInTheDocument();
    });
  });
});

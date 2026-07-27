import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TestResultsTable } from './TestResultsTable';
import type { TestResult } from '../types';

// jsdom gives the scroll container a 0px viewport, so the real virtualizer
// renders no rows. Mock it to emit one virtual item per test (the LotMobileList
// test's idiom) so the row's actions are actually in the DOM under test.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 64,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: index,
        start: index * 64,
        end: (index + 1) * 64,
      })),
    measureElement: () => {},
    scrollToIndex: () => {},
  }),
}));

function makeTest(overrides: Partial<TestResult> = {}): TestResult {
  return {
    id: 'test-1',
    testType: 'Density Ratio',
    testRequestNumber: 'TR-001',
    laboratoryName: 'Test Lab',
    laboratoryReportNumber: null,
    sampleDate: '2026-07-01',
    sampleLocation: null,
    testDate: null,
    resultDate: null,
    resultValue: null,
    resultUnit: null,
    specificationMin: 95,
    specificationMax: 100,
    passFail: 'pending',
    status: 'requested',
    verifiedBy: null,
    verifiedAt: null,
    lotId: 'lot-1',
    lot: { id: 'lot-1', lotNumber: 'L-001' },
    aiExtracted: false,
    certificateDocId: null,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

function renderTable({
  tests = [makeTest()],
  onUpdateStatus = vi.fn(),
  updatingStatusId = null,
}: {
  tests?: TestResult[];
  onUpdateStatus?: (testId: string, newStatus: string) => void;
  updatingStatusId?: string | null;
} = {}) {
  render(
    <MemoryRouter>
      <TestResultsTable
        projectId="project-1"
        filteredTestResults={tests}
        hasActiveFilters={false}
        updatingStatusId={updatingStatusId}
        onUpdateStatus={onUpdateStatus}
        onOpenEnterResults={vi.fn()}
        onRejectTest={vi.fn()}
        onAttachCertificate={vi.fn().mockResolvedValue(undefined)}
        onClearFilters={vi.fn()}
        onOpenCreateModal={vi.fn()}
      />
    </MemoryRouter>,
  );
  return { onUpdateStatus };
}

// AT-79 (Wave C2 Phase 2): 'at_lab' is reachable from the register row.
describe('TestResultsTable send-to-lab action', () => {
  it('sends a requested test to the lab', async () => {
    const user = userEvent.setup();
    const { onUpdateStatus } = renderTable({
      tests: [makeTest({ id: 'test-9', status: 'requested' })],
    });

    await user.click(screen.getByRole('button', { name: 'Send to lab' }));

    expect(onUpdateStatus).toHaveBeenCalledWith('test-9', 'at_lab');
  });

  it('hides the action once the test has left "requested"', () => {
    renderTable({
      tests: ['at_lab', 'results_received', 'entered', 'verified'].map((status) =>
        makeTest({ id: `test-${status}`, status }),
      ),
    });

    expect(screen.queryAllByRole('button', { name: 'Send to lab' })).toHaveLength(0);
  });

  it('leaves an at-lab row with its normal next action', () => {
    renderTable({ tests: [makeTest({ status: 'at_lab' })] });

    // Recording the result is still the way out of 'at_lab'.
    expect(screen.getByRole('button', { name: 'Enter Results' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Attach certificate' })).toBeInTheDocument();
  });

  it('does not replace the primary advance action for a requested test', () => {
    renderTable();

    // The mandatory next step is still recording the result.
    expect(screen.getByRole('button', { name: 'Enter Results' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send to lab' })).toBeInTheDocument();
  });

  it('disables the action while a status update for that row is in flight', () => {
    renderTable({ updatingStatusId: 'test-1' });

    expect(screen.getByRole('button', { name: 'Updating...' })).toBeDisabled();
  });
});

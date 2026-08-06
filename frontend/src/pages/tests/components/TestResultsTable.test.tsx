import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
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

// Radix positions the overflow menu with floating-ui, which observes its
// anchor. jsdom ships no ResizeObserver.
beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

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
  onLinkItpItem = vi.fn(),
  onRejectTest = vi.fn(),
  updatingStatusId = null,
}: {
  tests?: TestResult[];
  onUpdateStatus?: (testId: string, newStatus: string) => void;
  onLinkItpItem?: (test: TestResult) => void;
  onRejectTest?: (testId: string) => void;
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
        onRejectTest={onRejectTest}
        onAttachCertificate={vi.fn().mockResolvedValue(undefined)}
        onClearFilters={vi.fn()}
        onOpenCreateModal={vi.fn()}
        onLinkItpItem={onLinkItpItem}
      />
    </MemoryRouter>,
  );
  return { onUpdateStatus, onLinkItpItem, onRejectTest };
}

/** Opens a row's "…" menu and returns it. */
async function openRowMenu(user: ReturnType<typeof userEvent.setup>, testType = 'Density Ratio') {
  await user.click(screen.getByRole('button', { name: `More actions for ${testType}` }));
  return screen.getByRole('menu');
}

// The register's whole action set stays reachable — one visible primary action,
// everything else one tap away. This is the regression guard for the audit
// finding that put five wrapping buttons in a ~400px column.
describe('TestResultsTable row actions', () => {
  it('shows one primary action and keeps the rest in the overflow menu', async () => {
    const user = userEvent.setup();
    renderTable();

    // The mandatory next step is the only action rendered as a button.
    expect(screen.getByRole('button', { name: 'Enter Results' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send to lab' })).not.toBeInTheDocument();

    const menu = await openRowMenu(user);
    for (const label of ['Send to lab', 'Attach certificate', 'Read with AI', 'Link to ITP item']) {
      expect(within(menu).getByRole('menuitem', { name: label })).toBeInTheDocument();
    }
  });

  it('offers reject and the conformance record from the rows that earn them', async () => {
    const user = userEvent.setup();
    renderTable({
      tests: [
        makeTest({ id: 'test-entered', testType: 'Entered Test', status: 'entered' }),
        makeTest({
          id: 'test-verified',
          testType: 'Verified Test',
          status: 'verified',
          certificateDocId: 'doc-1',
        }),
      ],
    });

    const enteredMenu = await openRowMenu(user, 'Entered Test');
    expect(within(enteredMenu).getByRole('menuitem', { name: 'Reject' })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    const verifiedMenu = await openRowMenu(user, 'Verified Test');
    expect(
      within(verifiedMenu).getByRole('menuitem', { name: 'Print conformance record' }),
    ).toBeInTheDocument();
    // A verified test has no next step, and no certificate actions.
    expect(
      within(verifiedMenu).queryByRole('menuitem', { name: /certificate$/ }),
    ).not.toBeInTheDocument();
  });

  it('opens the ITP linker with the row whose menu was used', async () => {
    const user = userEvent.setup();
    const secondTest = makeTest({
      id: 'test-2',
      testType: 'CBR Laboratory',
      lotId: 'lot-2',
      lot: { id: 'lot-2', lotNumber: 'L-002' },
    });
    const { onLinkItpItem } = renderTable({ tests: [makeTest(), secondTest] });

    const menu = await openRowMenu(user, 'CBR Laboratory');
    await user.click(within(menu).getByRole('menuitem', { name: 'Link to ITP item' }));

    expect(onLinkItpItem).toHaveBeenCalledWith(secondTest);
  });

  it('hides Link to ITP item when the test has no linked lot', async () => {
    const user = userEvent.setup();
    renderTable({ tests: [makeTest({ lotId: null, lot: null })] });

    const menu = await openRowMenu(user);
    expect(
      within(menu).queryByRole('menuitem', { name: 'Link to ITP item' }),
    ).not.toBeInTheDocument();
  });

  // Both status chips read in the same Title Case vocabulary.
  it('renders the pass/fail chip in the same casing as the workflow status', () => {
    renderTable();

    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Requested')).toBeInTheDocument();
  });
});

// AT-79 (Wave C2 Phase 2): 'at_lab' is reachable from the register row.
describe('TestResultsTable send-to-lab action', () => {
  it('sends a requested test to the lab', async () => {
    const user = userEvent.setup();
    const { onUpdateStatus } = renderTable({
      tests: [makeTest({ id: 'test-9', status: 'requested' })],
    });

    const menu = await openRowMenu(user);
    await user.click(within(menu).getByRole('menuitem', { name: 'Send to lab' }));

    expect(onUpdateStatus).toHaveBeenCalledWith('test-9', 'at_lab');
  });

  it('hides the action once the test has left "requested"', async () => {
    const user = userEvent.setup();
    renderTable({
      tests: ['at_lab', 'results_received', 'entered', 'verified'].map((status) =>
        makeTest({ id: `test-${status}`, testType: `Test ${status}`, status }),
      ),
    });

    for (const status of ['at_lab', 'results_received', 'entered']) {
      const menu = await openRowMenu(user, `Test ${status}`);
      expect(within(menu).queryByRole('menuitem', { name: 'Send to lab' })).not.toBeInTheDocument();
      await user.keyboard('{Escape}');
    }
  });

  it('leaves an at-lab row with its normal next action', async () => {
    const user = userEvent.setup();
    renderTable({ tests: [makeTest({ status: 'at_lab' })] });

    // Recording the result is still the way out of 'at_lab'.
    expect(screen.getByRole('button', { name: 'Enter Results' })).toBeInTheDocument();
    const menu = await openRowMenu(user);
    expect(within(menu).getByRole('menuitem', { name: 'Attach certificate' })).toBeInTheDocument();
  });

  it('disables the action while a status update for that row is in flight', async () => {
    const user = userEvent.setup();
    renderTable({ updatingStatusId: 'test-1' });

    const menu = await openRowMenu(user);
    expect(within(menu).getByRole('menuitem', { name: 'Send to lab' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});

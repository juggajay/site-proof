import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TestResultsMobileList } from './TestResultsMobileList';
import type { TestResult } from '../types';

// jsdom does not implement scrollIntoView; the list calls it for deep links.
const scrollIntoView = vi.fn();
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
  // Radix positions the overflow menu with floating-ui, which observes its
  // anchor. jsdom ships no ResizeObserver.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

/** Opens a card's "…" menu and returns it. */
async function openCardMenu(user: ReturnType<typeof userEvent.setup>, testType = 'Density Ratio') {
  await user.click(screen.getByRole('button', { name: `More actions for ${testType}` }));
  return screen.getByRole('menu');
}

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
    resultValue: 98,
    resultUnit: '%',
    specificationMin: 95,
    specificationMax: 100,
    passFail: 'pass',
    status: 'verified',
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

function renderList({
  tests = [makeTest()],
  onLinkItpItem = vi.fn(),
  onUpdateStatus = vi.fn(),
  onRejectTest = vi.fn(),
}: {
  tests?: TestResult[];
  onLinkItpItem?: (test: TestResult) => void;
  onUpdateStatus?: (testId: string, newStatus: string) => void;
  onRejectTest?: (testId: string) => void;
} = {}) {
  render(
    <MemoryRouter>
      <TestResultsMobileList
        projectId="project-1"
        filteredTestResults={tests}
        hasActiveFilters={false}
        updatingStatusId={null}
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
  return { onLinkItpItem, onUpdateStatus, onRejectTest };
}

describe('TestResultsMobileList ITP link action', () => {
  it('shows Link to ITP item for a test with a linked lot', async () => {
    const user = userEvent.setup();
    renderList();

    const menu = await openCardMenu(user);
    expect(within(menu).getByRole('menuitem', { name: 'Link to ITP item' })).toBeInTheDocument();
  });

  it('hides Link to ITP item when the test has no linked lot', async () => {
    const user = userEvent.setup();
    // Not verified, so the card still has an overflow menu to look in.
    renderList({ tests: [makeTest({ status: 'entered', lotId: null, lot: null })] });

    const menu = await openCardMenu(user);
    expect(
      within(menu).queryByRole('menuitem', { name: 'Link to ITP item' }),
    ).not.toBeInTheDocument();
  });

  it('opens the linker with the card test that was tapped', async () => {
    const user = userEvent.setup();
    const firstTest = makeTest({ id: 'test-1', testType: 'Density Ratio' });
    const secondTest = makeTest({
      id: 'test-2',
      testType: 'CBR Laboratory',
      lotId: 'lot-2',
      lot: { id: 'lot-2', lotNumber: 'L-002' },
    });
    const { onLinkItpItem } = renderList({ tests: [firstTest, secondTest] });

    const menu = await openCardMenu(user, 'CBR Laboratory');
    await user.click(within(menu).getByRole('menuitem', { name: 'Link to ITP item' }));

    expect(onLinkItpItem).toHaveBeenCalledWith(secondTest);
  });
});

// The audit found one phone card stacking five full-width buttons (~450px
// tall). One primary button + the overflow menu replaces that, with nothing
// dropped.
describe('TestResultsMobileList card actions', () => {
  it('renders the next step as the only button and the rest in the menu', async () => {
    const user = userEvent.setup();
    renderList({ tests: [makeTest({ status: 'requested', passFail: 'pending' })] });

    expect(screen.getByRole('button', { name: 'Enter Results' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send to lab' })).not.toBeInTheDocument();

    const menu = await openCardMenu(user);
    for (const label of ['Send to lab', 'Attach certificate', 'Read with AI', 'Link to ITP item']) {
      expect(within(menu).getByRole('menuitem', { name: label })).toBeInTheDocument();
    }
  });

  it('keeps reject reachable for an entered test', async () => {
    const user = userEvent.setup();
    const { onRejectTest } = renderList({
      tests: [makeTest({ id: 'test-5', status: 'entered' })],
    });

    const menu = await openCardMenu(user);
    await user.click(within(menu).getByRole('menuitem', { name: 'Reject' }));

    expect(onRejectTest).toHaveBeenCalledWith('test-5');
  });
});

// AT-79 (Wave C2 Phase 2): 'at_lab' is reachable from the mobile card.
describe('TestResultsMobileList send-to-lab action', () => {
  it('sends a requested test to the lab', async () => {
    const user = userEvent.setup();
    const { onUpdateStatus } = renderList({
      tests: [makeTest({ id: 'test-9', status: 'requested', passFail: 'pending' })],
    });

    const menu = await openCardMenu(user);
    await user.click(within(menu).getByRole('menuitem', { name: 'Send to lab' }));

    expect(onUpdateStatus).toHaveBeenCalledWith('test-9', 'at_lab');
  });

  it('hides the action once the test has left "requested"', async () => {
    const user = userEvent.setup();
    renderList({
      tests: ['at_lab', 'results_received', 'entered', 'verified'].map((status) =>
        makeTest({ id: `test-${status}`, testType: `Test ${status}`, status }),
      ),
    });

    for (const status of ['at_lab', 'results_received', 'entered', 'verified']) {
      const menu = await openCardMenu(user, `Test ${status}`);
      expect(within(menu).queryByRole('menuitem', { name: 'Send to lab' })).not.toBeInTheDocument();
      await user.keyboard('{Escape}');
    }
  });

  // C3 Phase B2 §5.7 `[C3R-A5]`. The card is the per-test detail surface, and it
  // says the coordinate in the SAME words as the map pin popup.
  it('shows the captured sample point with its provenance and accuracy', () => {
    renderList({
      tests: [
        makeTest({
          sampleLocation: 'CH 1000+50, 2m LHS',
          // Prisma Decimal arrives as a string over JSON.
          sampleLatitude: '-33.8688',
          sampleLongitude: '151.2093',
          sampleLocationSource: 'gps',
          sampleLocationAccuracyM: '6.2',
        }),
      ],
    });

    // MobileDataCard renders a secondary field as one "label: value" span.
    expect(screen.getByText('Sample point: -33.868800, 151.209300 · GPS ±6 m')).toBeInTheDocument();
  });

  it('shows no sample-point row for a test whose location was never captured', () => {
    // Free text alone is not a location `[C3S-B1]`: the words are the record, the
    // pin is the position, and nothing turns one into the other.
    renderList({ tests: [makeTest({ sampleLocation: 'CH 1000+50, 2m LHS' })] });
    expect(screen.queryByText(/^Sample point:/)).not.toBeInTheDocument();
  });
});

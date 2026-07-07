import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TestResultsMobileList } from './TestResultsMobileList';
import type { TestResult } from '../types';

// jsdom does not implement scrollIntoView; the list calls it for deep links.
const scrollIntoView = vi.fn();
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
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
}: {
  tests?: TestResult[];
  onLinkItpItem?: (test: TestResult) => void;
} = {}) {
  render(
    <MemoryRouter>
      <TestResultsMobileList
        projectId="project-1"
        filteredTestResults={tests}
        hasActiveFilters={false}
        updatingStatusId={null}
        onUpdateStatus={vi.fn()}
        onOpenEnterResults={vi.fn()}
        onRejectTest={vi.fn()}
        onAttachCertificate={vi.fn().mockResolvedValue(undefined)}
        onClearFilters={vi.fn()}
        onOpenCreateModal={vi.fn()}
        onLinkItpItem={onLinkItpItem}
      />
    </MemoryRouter>,
  );
  return { onLinkItpItem };
}

describe('TestResultsMobileList ITP link action', () => {
  it('shows Link to ITP item for a test with a linked lot', () => {
    renderList();

    const action = screen.getByRole('button', { name: 'Link to ITP item' });
    expect(action).toBeInTheDocument();
    expect(action).toHaveClass('w-full');
  });

  it('hides Link to ITP item when the test has no linked lot', () => {
    renderList({ tests: [makeTest({ lotId: null, lot: null })] });

    expect(screen.queryByRole('button', { name: 'Link to ITP item' })).not.toBeInTheDocument();
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

    const actions = screen.getAllByRole('button', { name: 'Link to ITP item' });
    await user.click(actions[1]);

    expect(onLinkItpItem).toHaveBeenCalledWith(secondTest);
  });
});

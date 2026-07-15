import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';

import { CopilotPage } from './CopilotPage';

// Mutable fixtures the mocked hooks read, so each test can shape the stage cards.
const state = vi.hoisted(() => ({
  project: { name: 'MC10', state: 'NSW', code: 'C-1', clientName: 'RMS' } as Record<
    string,
    unknown
  > | null,
  controlLines: [] as unknown[],
  planSheets: [] as Array<{ hasRegistration: boolean }>,
  lotPresence: false,
  proposalsLoading: false,
  aiConfigured: true,
}));

vi.mock('./copilotData', () => ({
  useCopilotProposals: () => ({ data: [], isLoading: state.proposalsLoading }),
  useProjectLotPresence: () => ({ data: state.lotPresence }),
  useRollbackProposal: () => ({ mutateAsync: vi.fn(), isLoading: false }),
  newestProposalForStage: () => null,
}));
vi.mock('../settings/controlLinesData', () => ({
  useControlLines: () => ({ data: state.controlLines }),
}));
vi.mock('../settings/planSheetsData', () => ({
  usePlanSheets: () => ({ data: state.planSheets }),
}));
vi.mock('../settings/projectPageAccess', () => ({
  fetchProjectForAdminPage: () => Promise.resolve(state.project),
}));
vi.mock('@/hooks/useAiStatus', () => ({
  useAiStatus: () => ({ aiConfigured: state.aiConfigured }),
}));
vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));

// Stub each stage modal: renders a testid and an "apply" button that fires the
// apply → close sequence the real modals run, so we can drive the hand-off.
function stageModalStub(stage: string) {
  return (props: Record<string, unknown>) => (
    <div data-testid={`modal-${stage}`}>
      <button
        type="button"
        onClick={() => {
          (props.onApplied as (() => void) | undefined)?.();
          (props.onClose as () => void)();
        }}
      >
        {`apply-${stage}`}
      </button>
    </div>
  );
}
vi.mock('./ProjectFactsReviewModal', () => ({
  ProjectFactsReviewModal: stageModalStub('project_facts'),
}));
vi.mock('./ControlLineReviewModal', () => ({
  ControlLineReviewModal: stageModalStub('control_line'),
}));
vi.mock('./PlanSheetRegistrationReviewModal', () => ({
  PlanSheetRegistrationReviewModal: stageModalStub('plan_sheets'),
}));
vi.mock('./LotBreakdownReviewModal', () => ({
  LotBreakdownReviewModal: stageModalStub('lot_breakdown'),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="search">{location.search}</div>;
}

function renderAt(url: string): ReactElement {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route
            path="/projects/:projectId/copilot"
            element={
              <>
                <CopilotPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  ) as unknown as ReactElement;
}

describe('CopilotPage deep-link (?stage=)', () => {
  beforeEach(() => {
    state.project = { name: 'MC10', state: 'NSW', code: 'C-1', clientName: 'RMS' };
    state.controlLines = [];
    state.planSheets = [];
    state.lotPresence = false;
    state.proposalsLoading = false;
    state.aiConfigured = true;
  });

  it.each([['project_facts'], ['control_line'], ['plan_sheets'], ['lot_breakdown']])(
    'opens the %s stage and strips the param',
    async (stage) => {
      renderAt(`/projects/p1/copilot?stage=${stage}`);
      expect(await screen.findByTestId(`modal-${stage}`)).toBeInTheDocument();
      await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent(''));
    },
  );

  it('ignores an unknown stage but still renders the page and strips the param', async () => {
    renderAt('/projects/p1/copilot?stage=not_a_stage');
    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent(''));
    expect(screen.queryByTestId('modal-project_facts')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Setup copilot', level: 1 })).toBeInTheDocument();
  });

  it('ignores an AI-gated stage when AI is not configured', async () => {
    state.aiConfigured = false;
    renderAt('/projects/p1/copilot?stage=control_line');
    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent(''));
    expect(screen.queryByTestId('modal-control_line')).not.toBeInTheDocument();
  });

  it('does nothing without a stage param', async () => {
    renderAt('/projects/p1/copilot');
    await screen.findByRole('heading', { name: 'Setup copilot', level: 1 });
    expect(screen.queryByTestId('modal-project_facts')).not.toBeInTheDocument();
  });
});

describe('CopilotPage after-apply hand-off', () => {
  beforeEach(() => {
    state.project = { name: 'MC10', state: 'NSW', code: 'C-1', clientName: 'RMS' };
    state.controlLines = [];
    state.planSheets = [];
    state.lotPresence = false;
    state.proposalsLoading = false;
    state.aiConfigured = true;
  });

  it('offers the next incomplete stage after applying, and Go opens it', async () => {
    renderAt('/projects/p1/copilot');
    await screen.findByRole('heading', { name: 'Setup copilot', level: 1 });

    // Open control line via its CTA, then apply.
    fireEvent.click(screen.getByRole('button', { name: 'Read from setout sheet' }));
    fireEvent.click(await screen.findByRole('button', { name: 'apply-control_line' }));

    // Hand-off names the next incomplete stage (plan sheets) with a Go action.
    expect(await screen.findByText(/Control line done/)).toBeInTheDocument();
    expect(screen.getByText(/Next: plan sheets/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Go/ }));
    expect(await screen.findByTestId('modal-plan_sheets')).toBeInTheDocument();
  });

  it('says setup is complete when nothing remains', async () => {
    state.controlLines = [{}];
    state.planSheets = [{ hasRegistration: true }];
    state.lotPresence = true;
    renderAt('/projects/p1/copilot');
    await screen.findByRole('heading', { name: 'Setup copilot', level: 1 });

    // Every stage is done, so each CTA reads "Read again"; lot_breakdown is last.
    const readAgain = screen.getAllByRole('button', { name: 'Read again' });
    fireEvent.click(readAgain[readAgain.length - 1]);
    fireEvent.click(await screen.findByRole('button', { name: 'apply-lot_breakdown' }));

    expect(await screen.findByText(/Setup complete/)).toBeInTheDocument();
  });
});

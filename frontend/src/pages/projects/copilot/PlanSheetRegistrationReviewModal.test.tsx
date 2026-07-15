import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PlanSheetRegistrationReviewModal } from './PlanSheetRegistrationReviewModal';
import type { PlanSheetListItem } from '../settings/planSheetsData';
import type { CopilotProposal } from './copilotData';

const extractMutateAsync = vi.hoisted(() => vi.fn());
const decideMutateAsync = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());
// Captures the props the (mocked) full-screen registration editor is seeded with.
const editorProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));

vi.mock('./copilotData', () => ({
  useExtractPlanSheet: () => ({ mutateAsync: extractMutateAsync, isLoading: false }),
  useDecideProposal: () => ({ mutateAsync: decideMutateAsync, isLoading: false }),
}));
vi.mock('@/components/ui/toaster', () => ({ toast: toastMock }));
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));

// The real editor pulls in leaflet + data hooks; stub it to expose the seeded
// points and the two decision callbacks so we can assert wiring cheaply.
vi.mock('../settings/PlanSheetRegistrationModal', () => ({
  PlanSheetRegistrationModal: (props: Record<string, unknown>) => {
    editorProps.current = props;
    const points = props.initialPoints as Array<{ px: number; py: number; eastingText: string }>;
    return (
      <div data-testid="registration-editor">
        <span data-testid="seed-count">{points.length}</span>
        <span data-testid="seed-first-px">{points[0]?.px}</span>
        <span data-testid="seed-first-py">{points[0]?.py}</span>
        <button
          type="button"
          onClick={() =>
            void (props.onSubmitRegistration as (r: unknown) => Promise<void>)({
              points: [],
              transform: [1, 0, 0, 0, 1, 0],
              rmsErrorM: 0.1,
            })
          }
        >
          apply
        </button>
        <button type="button" onClick={() => (props.onDismiss as () => void)()}>
          dismiss
        </button>
      </div>
    );
  },
}));

const SHEET: PlanSheetListItem = {
  id: 'sheet-1',
  name: 'Sheet 05',
  pageNumber: 5,
  imageWidth: 1000,
  imageHeight: 800,
  coordinateSystem: 'EPSG:7856',
  hasRegistration: false,
  cornersWgs84: null,
  perimeter: null,
  createdAt: '',
  updatedAt: '',
};

const CANDIDATE = {
  planSheetId: 'sheet-1',
  coordinateSystem: 'EPSG:7856',
  points: [
    { easting: 331000, northing: 6250000, label: 'NW', approxX: 0.2, approxY: 0.3 },
    { easting: 331200, northing: 6249800, label: 'SE', approxX: null, approxY: null },
  ],
};

describe('PlanSheetRegistrationReviewModal', () => {
  beforeEach(() => {
    extractMutateAsync.mockReset();
    decideMutateAsync.mockReset();
    toastMock.mockReset();
    editorProps.current = null;
  });

  it('reads a picked sheet then seeds markers at the AI positions (null → sheet centre)', async () => {
    extractMutateAsync.mockResolvedValue({ proposalId: 'p-1', candidate: CANDIDATE, warnings: [] });

    render(
      <PlanSheetRegistrationReviewModal projectId="project-1" sheets={[SHEET]} onClose={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Read from sheet' }));
    await waitFor(() => expect(screen.getByTestId('registration-editor')).toBeInTheDocument());

    expect(extractMutateAsync).toHaveBeenCalledWith('sheet-1');
    expect(screen.getByTestId('seed-count')).toHaveTextContent('2');
    // approxX 0.2 * width 1000 = 200; approxY 0.3 * height 800 = 240.
    expect(screen.getByTestId('seed-first-px')).toHaveTextContent('200');
    expect(screen.getByTestId('seed-first-py')).toHaveTextContent('240');
    // Second point had null positions → seeded at centre (0.5 * dims).
    const second = (editorProps.current!.initialPoints as Array<{ px: number; py: number }>)[1];
    expect(second).toEqual({ px: 500, py: 400, eastingText: '331200', northingText: '6249800' });
  });

  it('opens straight into review from an existing proposal and applies via the decision endpoint', async () => {
    decideMutateAsync.mockResolvedValue({ id: 'p-9', status: 'edited' });
    const onClose = vi.fn();
    const proposal = { id: 'p-9', payload: CANDIDATE } as unknown as CopilotProposal;

    render(
      <PlanSheetRegistrationReviewModal
        projectId="project-1"
        sheets={[SHEET]}
        existingProposal={proposal}
        onClose={onClose}
      />,
    );

    // No picker — the editor is shown immediately.
    expect(screen.getByTestId('registration-editor')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'apply' }));

    await waitFor(() => expect(decideMutateAsync).toHaveBeenCalledTimes(1));
    expect(decideMutateAsync).toHaveBeenCalledWith({
      proposalId: 'p-9',
      action: 'accept',
      editedPayload: {
        planSheetId: 'sheet-1',
        registration: { points: [], transform: [1, 0, 0, 0, 1, 0], rmsErrorM: 0.1 },
      },
    });
  });

  it('dismisses a suggestion via reject', async () => {
    decideMutateAsync.mockResolvedValue({ id: 'p-9', status: 'rejected' });
    const onClose = vi.fn();
    const proposal = { id: 'p-9', payload: CANDIDATE } as unknown as CopilotProposal;

    render(
      <PlanSheetRegistrationReviewModal
        projectId="project-1"
        sheets={[SHEET]}
        existingProposal={proposal}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'dismiss' }));
    await waitFor(() =>
      expect(decideMutateAsync).toHaveBeenCalledWith({ proposalId: 'p-9', action: 'reject' }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('shows an empty state when there are no sheets to register', () => {
    render(
      <PlanSheetRegistrationReviewModal projectId="project-1" sheets={[]} onClose={vi.fn()} />,
    );
    expect(screen.getByText(/No plan sheets yet/)).toBeInTheDocument();
  });
});

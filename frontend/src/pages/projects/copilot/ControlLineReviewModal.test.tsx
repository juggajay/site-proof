import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ControlLineReviewModal } from './ControlLineReviewModal';
import type { SetoutExtractionCandidate } from '../settings/controlLinesData';

const extractMutateAsync = vi.hoisted(() => vi.fn());
const decideMutateAsync = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());

vi.mock('./copilotData', () => ({
  useExtractControlLine: () => ({ mutateAsync: extractMutateAsync, isLoading: false }),
  useDecideProposal: () => ({ mutateAsync: decideMutateAsync, isLoading: false }),
}));
vi.mock('@/components/ui/toaster', () => ({ toast: toastMock }));
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));

const CANDIDATE: SetoutExtractionCandidate = {
  warnings: ['Sheet 2 title block partly obscured.'],
  alignments: [
    {
      name: 'Weinam Creek Rd',
      coordinateSystem: 'EPSG:7856',
      warnings: [],
      page: 3,
      points: [
        { chainage: 0, easting: 500000, northing: 6250000 },
        { chainage: 100, easting: 500100, northing: 6250000 },
      ],
    },
    {
      name: 'Boat Harbour Dr',
      coordinateSystem: 'EPSG:7855',
      warnings: [],
      points: [
        { chainage: 0, easting: 300000, northing: 5800000 },
        { chainage: 80, easting: 300080, northing: 5800000 },
      ],
    },
  ],
};

function selectFile(name = 'MC01 setout.pdf') {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(['%PDF-1.4'], name, { type: 'application/pdf' });
  fireEvent.change(input, { target: { files: [file] } });
}

describe('ControlLineReviewModal', () => {
  beforeEach(() => {
    extractMutateAsync.mockReset();
    decideMutateAsync.mockReset();
    toastMock.mockReset();
  });

  it('extracts, reviews the alignments, and applies via the decision endpoint', async () => {
    extractMutateAsync.mockResolvedValue({
      proposalId: 'p-1',
      candidate: CANDIDATE,
      warnings: CANDIDATE.warnings,
    });
    decideMutateAsync.mockResolvedValue({ id: 'p-1', status: 'edited' });
    const onClose = vi.fn();

    render(<ControlLineReviewModal projectId="project-1" onClose={onClose} />);
    selectFile();

    await waitFor(() => expect(screen.getByDisplayValue('Weinam Creek Rd')).toBeInTheDocument());
    expect(screen.getByDisplayValue('Boat Harbour Dr')).toBeInTheDocument();
    expect(screen.getByTestId('control-line-document-warnings')).toHaveTextContent(
      'partly obscured',
    );
    // The per-alignment page citation is surfaced.
    expect(screen.getByText(/p\.3/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Save 2 control lines/ }));

    await waitFor(() => expect(decideMutateAsync).toHaveBeenCalledTimes(1));
    expect(decideMutateAsync).toHaveBeenCalledWith({
      proposalId: 'p-1',
      action: 'accept',
      editedPayload: {
        alignments: [
          {
            name: 'Weinam Creek Rd',
            coordinateSystem: 'EPSG:7856',
            points: CANDIDATE.alignments[0].points,
            selected: true,
          },
          {
            name: 'Boat Harbour Dr',
            coordinateSystem: 'EPSG:7855',
            points: CANDIDATE.alignments[1].points,
            selected: true,
          },
        ],
      },
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('marks an unchecked alignment selected:false and dismisses via reject', async () => {
    extractMutateAsync.mockResolvedValue({ proposalId: 'p-2', candidate: CANDIDATE, warnings: [] });
    decideMutateAsync.mockResolvedValue({ id: 'p-2', status: 'edited' });

    render(<ControlLineReviewModal projectId="project-1" onClose={vi.fn()} />);
    selectFile();

    await waitFor(() => expect(screen.getByDisplayValue('Weinam Creek Rd')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Include Boat Harbour Dr'));

    fireEvent.click(screen.getByRole('button', { name: /Save 1 control line/ }));
    await waitFor(() => expect(decideMutateAsync).toHaveBeenCalledTimes(1));
    const arg = decideMutateAsync.mock.calls[0][0];
    expect(arg.editedPayload.alignments[1].selected).toBe(false);

    // Reject path routes through the decision endpoint too.
    decideMutateAsync.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() =>
      expect(decideMutateAsync).toHaveBeenCalledWith({ proposalId: 'p-2', action: 'reject' }),
    );
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SetoutImportModal } from './SetoutImportModal';
import type { SetoutExtractionCandidate } from './controlLinesData';

const extractMutateAsync = vi.hoisted(() => vi.fn());
const createMutateAsync = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());

vi.mock('./controlLinesData', () => ({
  useExtractSetoutPoints: () => ({ mutateAsync: extractMutateAsync, isLoading: false }),
  useCreateControlLine: () => ({ mutateAsync: createMutateAsync, isLoading: false }),
}));
vi.mock('@/components/ui/toaster', () => ({ toast: toastMock }));
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));

const CANDIDATE: SetoutExtractionCandidate = {
  coordinateSystem: 'EPSG:7856',
  warnings: ['Row 3 dropped: could not read numeric chainage/easting/northing.'],
  points: [
    { chainage: 1000, easting: 500000, northing: 6250000 },
    { chainage: 1100, easting: 500100, northing: 6250000 },
  ],
};

function selectFile(name = 'MC01 setout.pdf') {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(['%PDF-1.4'], name, { type: 'application/pdf' });
  fireEvent.change(input, { target: { files: [file] } });
}

describe('SetoutImportModal', () => {
  beforeEach(() => {
    extractMutateAsync.mockReset();
    createMutateAsync.mockReset();
    toastMock.mockReset();
  });

  it('extracts a sheet, shows points + warnings, and saves the reviewed line', async () => {
    extractMutateAsync.mockResolvedValue(CANDIDATE);
    createMutateAsync.mockResolvedValue({ id: 'cl-1' });
    const onClose = vi.fn();

    render(
      <SetoutImportModal
        projectId="project-1"
        defaultCoordinateSystem="EPSG:7855"
        onClose={onClose}
      />,
    );

    selectFile();

    // Name defaults to the file stem; the extraction mutation fired.
    await waitFor(() => expect(screen.getByDisplayValue('MC01 setout')).toBeInTheDocument());
    expect(extractMutateAsync).toHaveBeenCalledTimes(1);

    // A dropped row surfaces as a warning, and every point is shown for review.
    expect(screen.getByTestId('setout-warnings')).toHaveTextContent('Row 3 dropped');
    expect(screen.getByText('500,100')).toBeInTheDocument();

    // The AI's supported zone overrides the project default.
    expect((screen.getByLabelText('Coordinate system *') as HTMLSelectElement).value).toBe(
      'EPSG:7856',
    );

    fireEvent.click(screen.getByRole('button', { name: /Save control line/ }));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
    expect(createMutateAsync).toHaveBeenCalledWith({
      name: 'MC01 setout',
      coordinateSystem: 'EPSG:7856',
      points: CANDIDATE.points,
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('falls back to the project zone when the AI could not read a datum', async () => {
    extractMutateAsync.mockResolvedValue({ ...CANDIDATE, coordinateSystem: null });
    render(
      <SetoutImportModal
        projectId="project-1"
        defaultCoordinateSystem="EPSG:7855"
        onClose={vi.fn()}
      />,
    );

    selectFile();

    await waitFor(() => expect(screen.getByDisplayValue('MC01 setout')).toBeInTheDocument());
    expect((screen.getByLabelText('Coordinate system *') as HTMLSelectElement).value).toBe(
      'EPSG:7855',
    );
  });

  it('shows the backend message when AI extraction is not configured', async () => {
    extractMutateAsync.mockRejectedValue(
      new Error(
        'AI setout extraction is not configured on this server. Enter the control points manually.',
      ),
    );
    render(<SetoutImportModal projectId="project-1" onClose={vi.fn()} />);

    selectFile();

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'error',
          description: expect.stringContaining('not configured'),
        }),
      ),
    );
    // Save stays disabled — there is no candidate to save.
    expect(screen.getByRole('button', { name: /Save control line/ })).toBeDisabled();
    expect(createMutateAsync).not.toHaveBeenCalled();
  });
});

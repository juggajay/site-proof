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

// Single-alignment sheet (the common case): pixel-equivalent to the pre-grouping UI.
const SINGLE: SetoutExtractionCandidate = {
  warnings: [],
  alignments: [
    {
      name: null,
      coordinateSystem: 'EPSG:7856',
      warnings: ['Row 3 dropped: could not read numeric chainage/easting/northing.'],
      points: [
        { chainage: 1000, easting: 500000, northing: 6250000 },
        { chainage: 1100, easting: 500100, northing: 6250000 },
      ],
    },
  ],
};

// Multi-street sheet (Weinam Creek): two alignments the user saves as two lines.
const MULTI: SetoutExtractionCandidate = {
  warnings: ['Sheet 2 title block partly obscured.'],
  alignments: [
    {
      name: 'Weinam Creek Rd',
      coordinateSystem: 'EPSG:7856',
      warnings: [],
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

describe('SetoutImportModal', () => {
  beforeEach(() => {
    extractMutateAsync.mockReset();
    createMutateAsync.mockReset();
    toastMock.mockReset();
  });

  it('extracts a single-alignment sheet, shows points + warnings, and saves the reviewed line', async () => {
    extractMutateAsync.mockResolvedValue(SINGLE);
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
      points: SINGLE.alignments[0].points,
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('falls back to the project zone when the AI could not read a datum', async () => {
    extractMutateAsync.mockResolvedValue({
      ...SINGLE,
      alignments: [{ ...SINGLE.alignments[0], coordinateSystem: null }],
    });
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

  it('lists each alignment and saves one control line per checked alignment', async () => {
    extractMutateAsync.mockResolvedValue(MULTI);
    createMutateAsync.mockResolvedValue({ id: 'x' });
    const onClose = vi.fn();

    render(<SetoutImportModal projectId="project-1" onClose={onClose} />);
    selectFile();

    // Both alignments are listed with AI-read names prefilled, and the
    // document-level warning is surfaced once.
    await waitFor(() => expect(screen.getByDisplayValue('Weinam Creek Rd')).toBeInTheDocument());
    expect(screen.getByDisplayValue('Boat Harbour Dr')).toBeInTheDocument();
    expect(screen.getByTestId('setout-document-warnings')).toHaveTextContent('partly obscured');

    fireEvent.click(screen.getByRole('button', { name: /Save 2 control lines/ }));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(2));
    expect(createMutateAsync).toHaveBeenNthCalledWith(1, {
      name: 'Weinam Creek Rd',
      coordinateSystem: 'EPSG:7856',
      points: MULTI.alignments[0].points,
    });
    expect(createMutateAsync).toHaveBeenNthCalledWith(2, {
      name: 'Boat Harbour Dr',
      coordinateSystem: 'EPSG:7855',
      points: MULTI.alignments[1].points,
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('only saves checked alignments, and honours a renamed alignment', async () => {
    extractMutateAsync.mockResolvedValue(MULTI);
    createMutateAsync.mockResolvedValue({ id: 'x' });

    render(<SetoutImportModal projectId="project-1" onClose={vi.fn()} />);
    selectFile();

    await waitFor(() => expect(screen.getByDisplayValue('Weinam Creek Rd')).toBeInTheDocument());

    // Rename the first alignment and untick the second.
    fireEvent.change(screen.getByDisplayValue('Weinam Creek Rd'), {
      target: { value: 'MC01 – main' },
    });
    fireEvent.click(screen.getByLabelText('Include Boat Harbour Dr'));

    fireEvent.click(screen.getByRole('button', { name: /Save 1 control line/ }));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
    expect(createMutateAsync).toHaveBeenCalledWith({
      name: 'MC01 – main',
      coordinateSystem: 'EPSG:7856',
      points: MULTI.alignments[0].points,
    });
  });

  it('reports partial failure and keeps the failed alignment for retry', async () => {
    extractMutateAsync.mockResolvedValue(MULTI);
    createMutateAsync
      .mockResolvedValueOnce({ id: 'ok' })
      .mockRejectedValueOnce(new Error('Coordinates fall outside the selected zone.'));
    const onClose = vi.fn();

    render(<SetoutImportModal projectId="project-1" onClose={onClose} />);
    selectFile();

    await waitFor(() => expect(screen.getByDisplayValue('Weinam Creek Rd')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Save 2 control lines/ }));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(2));

    // The modal stays open, an error toast reports the split, and the failed row's
    // message is shown.
    expect(onClose).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'error',
        description: expect.stringContaining('Saved 1'),
      }),
    );
    expect(screen.getByText('Coordinates fall outside the selected zone.')).toBeInTheDocument();

    // The saved alignment drops out; only the failed one remains savable.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Save 1 control line/ })).toBeInTheDocument(),
    );
  });
});

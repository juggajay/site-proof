import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ControlLineImportModal } from './ControlLineImportModal';
import type { AlignmentImportPreview } from './controlLinesData';

const importMutateAsync = vi.hoisted(() => vi.fn());
const createMutateAsync = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());

vi.mock('./controlLinesData', () => ({
  useImportAlignments: () => ({ mutateAsync: importMutateAsync, isLoading: false }),
  useCreateControlLine: () => ({ mutateAsync: createMutateAsync, isLoading: false }),
}));
vi.mock('@/components/ui/toaster', () => ({ toast: toastMock }));
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));

const PREVIEW: AlignmentImportPreview = {
  format: 'landxml',
  warnings: ['Skipped "Ramp": contains an unsupported <Spiral> element'],
  alignments: [
    {
      name: 'MC01',
      points: [
        { chainage: 1000, easting: 500000, northing: 6250000 },
        { chainage: 1100, easting: 500100, northing: 6250000 },
      ],
      pointCount: 2,
      chainageStart: 1000,
      chainageEnd: 1100,
      lengthM: 100,
      bbox: { minE: 500000, minN: 6250000, maxE: 500100, maxN: 6250000 },
    },
  ],
};

function selectFile() {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(['<LandXML/>'], 'design.landxml', { type: 'application/xml' });
  fireEvent.change(input, { target: { files: [file] } });
}

describe('ControlLineImportModal', () => {
  beforeEach(() => {
    importMutateAsync.mockReset();
    createMutateAsync.mockReset();
    toastMock.mockReset();
  });

  it('parses a file, shows the preview + warnings, and creates selected lines', async () => {
    importMutateAsync.mockResolvedValue(PREVIEW);
    createMutateAsync.mockResolvedValue({ id: 'cl-1' });
    const onClose = vi.fn();

    render(
      <ControlLineImportModal
        projectId="project-1"
        defaultCoordinateSystem="EPSG:7855"
        onClose={onClose}
      />,
    );

    selectFile();

    await waitFor(() => expect(screen.getByDisplayValue('MC01')).toBeInTheDocument());
    // Rejected spiral alignment surfaces as a warning.
    expect(screen.getByTestId('import-warnings')).toHaveTextContent('Spiral');
    // Zone defaults to the project's existing control-line CRS.
    expect((screen.getByLabelText('Coordinate system *') as HTMLSelectElement).value).toBe(
      'EPSG:7855',
    );

    fireEvent.click(screen.getByRole('button', { name: /Import/ }));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
    expect(createMutateAsync).toHaveBeenCalledWith({
      name: 'MC01',
      coordinateSystem: 'EPSG:7855',
      points: PREVIEW.alignments[0].points,
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('does not create anything when the alignment is unchecked', async () => {
    importMutateAsync.mockResolvedValue(PREVIEW);
    render(<ControlLineImportModal projectId="project-1" onClose={vi.fn()} />);

    selectFile();
    await waitFor(() => expect(screen.getByDisplayValue('MC01')).toBeInTheDocument());

    const row = screen.getByDisplayValue('MC01').closest('tr')!;
    fireEvent.click(within(row).getByRole('checkbox'));

    // With nothing selected the Import button is disabled.
    expect(screen.getByRole('button', { name: /Import/ })).toBeDisabled();
    expect(createMutateAsync).not.toHaveBeenCalled();
  });

  it('toasts an error when the file cannot be parsed', async () => {
    importMutateAsync.mockRejectedValue(new Error('File is not valid XML'));
    render(<ControlLineImportModal projectId="project-1" onClose={vi.fn()} />);

    selectFile();

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' })),
    );
  });
});

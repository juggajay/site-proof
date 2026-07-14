import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ apiFetch }));

const toastMock = vi.hoisted(() => vi.fn());
vi.mock('@/components/ui/toaster', () => ({ toast: toastMock }));

const invalidateQueries = vi.hoisted(() => vi.fn());
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries }),
}));

// One 1000m control line so the wizard can offer map geometry.
vi.mock('@/pages/lots/map/lotMapData', () => ({
  useProjectControlLines: () => ({
    data: [
      {
        id: 'cl-1',
        projectId: 'proj-1',
        name: 'MC00',
        coordinateSystem: 'EPSG:7856',
        points: [
          { chainage: 0, easting: 334000, northing: 6252000 },
          { chainage: 1000, easting: 334000, northing: 6253000 },
        ],
        geometryWgs84: null,
      },
    ],
    isLoading: false,
    error: null,
  }),
}));

import { BulkCreateLotsWizard } from './BulkCreateLotsWizard';

function fillChainageStep() {
  fireEvent.change(screen.getByLabelText(/Start Chainage/i), { target: { value: '0' } });
  fireEvent.change(screen.getByLabelText(/End Chainage/i), { target: { value: '1000' } });
  fireEvent.change(screen.getByLabelText(/Lot Interval/i), { target: { value: '250' } });
}

describe('BulkCreateLotsWizard generation payload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch.mockImplementation((path: string) => {
      if (path.startsWith('/api/itp/templates')) {
        return Promise.resolve({
          templates: [{ id: 'tpl-1', name: 'Drainage ITP', activityType: 'Drainage' }],
        });
      }
      return Promise.resolve({ count: 4, itpInstancesCreated: 4, geometriesCreated: 4 });
    });
  });

  it('sends itpTemplateId and geometry with the lots and reports the extras', async () => {
    render(<BulkCreateLotsWizard projectId="proj-1" onClose={vi.fn()} onSuccess={vi.fn()} />);

    fillChainageStep();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(screen.getByLabelText(/ITP Template/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/ITP Template/i), { target: { value: 'tpl-1' } });
    fireEvent.change(screen.getByLabelText(/Map Geometry/i), { target: { value: 'cl-1' } });
    fireEvent.change(screen.getByLabelText(/Offset Left/i), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText(/Offset Right/i), { target: { value: '6' } });

    fireEvent.click(screen.getByRole('button', { name: 'Next' })); // → preview
    expect(screen.getByText(/Total: 4 lots will be created/)).toBeInTheDocument();
    expect(screen.getByText(/Drainage ITP/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' })); // → confirm
    fireEvent.click(screen.getByRole('button', { name: 'Create Lots' }));

    await waitFor(() => expect(toastMock).toHaveBeenCalled());

    const bulkCall = apiFetch.mock.calls.find(([path]) => path === '/api/lots/bulk');
    expect(bulkCall).toBeDefined();
    const body = JSON.parse((bulkCall![1] as { body: string }).body);
    expect(body.itpTemplateId).toBe('tpl-1');
    expect(body.geometry).toEqual({ controlLineId: 'cl-1', offsetLeft: 4, offsetRight: 6 });
    expect(body.lots).toHaveLength(4);
    expect(body.lots[0]).toMatchObject({ chainageStart: 0, chainageEnd: 250 });

    expect(invalidateQueries).toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'success',
        description: expect.stringContaining('4 ITPs assigned'),
      }),
    );
  });

  it('omits geometry and template when neither is selected and skips invalidation', async () => {
    render(<BulkCreateLotsWizard projectId="proj-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
    apiFetch.mockImplementation((path: string) =>
      path.startsWith('/api/itp/templates')
        ? Promise.resolve({ templates: [] })
        : Promise.resolve({ count: 4, itpInstancesCreated: 0, geometriesCreated: 0 }),
    );

    fillChainageStep();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create Lots' }));

    await waitFor(() => expect(toastMock).toHaveBeenCalled());
    const bulkCall = apiFetch.mock.calls.find(([path]) => path === '/api/lots/bulk');
    const body = JSON.parse((bulkCall![1] as { body: string }).body);
    expect(body.itpTemplateId).toBeUndefined();
    expect(body.geometry).toBeUndefined();
    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it('blocks preview when the range falls outside the selected control line', async () => {
    render(<BulkCreateLotsWizard projectId="proj-1" onClose={vi.fn()} onSuccess={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Start Chainage/i), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText(/End Chainage/i), { target: { value: '1500' } });
    fireEvent.change(screen.getByLabelText(/Lot Interval/i), { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    fireEvent.change(screen.getByLabelText(/Map Geometry/i), { target: { value: 'cl-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'error',
          description: expect.stringContaining('MC00 covers CH 0–1000'),
        }),
      ),
    );
    // Still on the parameters step — no preview table rendered.
    expect(screen.queryByText(/Total:/)).not.toBeInTheDocument();
  });
});

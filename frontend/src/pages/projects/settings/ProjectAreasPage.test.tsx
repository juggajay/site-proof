import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectAreasPage } from './ProjectAreasPage';

const apiFetchMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  apiFetch: apiFetchMock,
}));

vi.mock('@/components/ui/toaster', () => ({
  toast: toastMock,
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}));

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/projects/project-1/areas']}>
      <Routes>
        <Route path="/projects/:projectId/areas" element={<ProjectAreasPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function getPostCalls() {
  return apiFetchMock.mock.calls.filter(([, options]) => options?.method === 'POST');
}

async function openAddAreaModal() {
  await screen.findByText('No areas defined');
  fireEvent.click(screen.getByRole('button', { name: 'Add Area' }));
  return screen.getByRole('dialog', { name: 'Add Area' });
}

describe('ProjectAreasPage', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    toastMock.mockReset();
    apiFetchMock.mockResolvedValue({ areas: [] });
  });

  it('blocks name-only area saves before sending a create request', async () => {
    renderPage();

    const dialog = await openAddAreaModal();
    fireEvent.change(within(dialog).getByLabelText(/Area Name/), {
      target: { value: 'Zone 1' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Area' }));

    expect(getPostCalls()).toHaveLength(0);
    expect(toastMock).toHaveBeenCalledWith({
      title: 'Chainage required',
      description: 'Enter both chainage start and chainage end for this area.',
      variant: 'error',
    });
  });

  it('posts parsed chainage bounds for a valid area', async () => {
    apiFetchMock.mockImplementation(async (_path: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        return {
          area: {
            id: 'area-1',
            name: 'Zone 1',
            chainageStart: 10.5,
            chainageEnd: 250.25,
            colour: '#3B82F6',
            createdAt: '2026-06-21T00:00:00.000Z',
          },
        };
      }
      return { areas: [] };
    });

    renderPage();

    const dialog = await openAddAreaModal();
    fireEvent.change(within(dialog).getByLabelText(/Area Name/), {
      target: { value: '  Zone 1  ' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Chainage Start/), {
      target: { value: '10.5' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Chainage End/), {
      target: { value: '250.25' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Area' }));

    await waitFor(() => expect(getPostCalls()).toHaveLength(1));
    expect(getPostCalls()[0]).toEqual([
      '/api/projects/project-1/areas',
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'Zone 1',
          chainageStart: 10.5,
          chainageEnd: 250.25,
          colour: '#3B82F6',
        }),
      },
    ]);
  });
});

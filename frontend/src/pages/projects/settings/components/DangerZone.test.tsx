import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/lib/api';
import { renderWithProviders } from '@/test/renderWithProviders';
import { DangerZone } from './DangerZone';
import type { Project } from '../types';

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    apiFetch: apiFetchMock,
  };
});

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

const project = {
  id: 'project-1',
  name: 'QA Project',
  status: 'active',
  settings: {},
} as Project;

describe('DangerZone permissions', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('keeps archive and complete actions visible when permanent delete is not allowed', () => {
    renderWithProviders(
      <DangerZone
        projectId="project-1"
        project={project}
        onProjectUpdate={vi.fn()}
        canDeleteProject={false}
      />,
    );

    expect(screen.getByRole('button', { name: /mark as completed/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /archive project/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete project/i })).not.toBeInTheDocument();
  });

  it('shows permanent delete only for project deleters', () => {
    renderWithProviders(
      <DangerZone
        projectId="project-1"
        project={project}
        onProjectUpdate={vi.fn()}
        canDeleteProject
      />,
    );

    expect(screen.getByRole('button', { name: /delete project/i })).toBeInTheDocument();
  });

  it('only offers restore for an archived project', () => {
    renderWithProviders(
      <DangerZone
        projectId="project-1"
        project={{ ...project, status: 'archived' }}
        onProjectUpdate={vi.fn()}
        canDeleteProject={false}
      />,
    );

    expect(screen.queryByRole('button', { name: /mark as completed/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /restore project/i })).toBeInTheDocument();
    expect(screen.getByText(/currently archived \(read-only\)/i)).toBeInTheDocument();
  });

  it('shows the server auth message for delete failures that are not bad passwords', async () => {
    const user = userEvent.setup();
    apiFetchMock.mockRejectedValueOnce(
      new ApiError(401, JSON.stringify({ message: 'Session expired. Please sign in again.' })),
    );

    renderWithProviders(
      <DangerZone
        projectId="project-1"
        project={project}
        onProjectUpdate={vi.fn()}
        canDeleteProject
      />,
    );

    await user.click(screen.getByRole('button', { name: /delete project/i }));
    const deleteDialog = screen.getByRole('alertdialog', { name: /delete project/i });
    await user.type(within(deleteDialog).getByLabelText(/password/i), 'SecureP@ssword123!');
    await user.click(within(deleteDialog).getByRole('button', { name: /^delete project$/i }));

    expect(await within(deleteDialog).findByRole('alert')).toHaveTextContent(
      'Session expired. Please sign in again.',
    );
    expect(within(deleteDialog).queryByText('Incorrect password')).not.toBeInTheDocument();
  });
});

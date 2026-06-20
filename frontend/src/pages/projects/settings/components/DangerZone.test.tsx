import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/renderWithProviders';
import { DangerZone } from './DangerZone';
import type { Project } from '../types';

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
});

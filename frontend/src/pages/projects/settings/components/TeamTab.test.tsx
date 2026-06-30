import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamTab } from './TeamTab';

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  apiFetch: apiFetchMock,
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  apiFetchMock.mockReset();
  apiFetchMock.mockResolvedValue({ users: [] });
});

describe('TeamTab', () => {
  function renderTeamTab(canGrantProjectAdmin = false) {
    render(
      <MemoryRouter>
        <TeamTab projectId="project-1" canGrantProjectAdmin={canGrantProjectAdmin} />
      </MemoryRouter>,
    );
  }

  it('links to full project team management for role changes and removals', async () => {
    renderTeamTab();

    const manageLink = await screen.findByRole('link', { name: 'Manage project team' });
    expect(manageLink).toHaveAttribute('href', '/projects/project-1/users');
    expect(
      screen.getByText(
        'Review this project team. Use Project Users for role changes and removals.',
      ),
    ).toBeInTheDocument();
  });

  it('does not offer protected project management roles when the actor cannot grant them', async () => {
    const user = userEvent.setup();
    renderTeamTab(false);

    await user.click(await screen.findByRole('button', { name: /invite team member/i }));

    const roleSelect = screen.getByLabelText('Role');
    expect(within(roleSelect).queryByRole('option', { name: 'Admin' })).toBeNull();
    expect(within(roleSelect).queryByRole('option', { name: 'Project Manager' })).toBeNull();

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/projects/project-1/users');
    });
  });

  it('offers Project Admin when the actor can grant it', async () => {
    const user = userEvent.setup();
    renderTeamTab(true);

    await user.click(await screen.findByRole('button', { name: /invite team member/i }));

    expect(
      within(screen.getByLabelText('Role')).getByRole('option', { name: 'Admin' }),
    ).toBeInTheDocument();
  });
});

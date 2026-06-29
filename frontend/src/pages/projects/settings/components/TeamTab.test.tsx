import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  it('does not offer Project Admin when the actor cannot grant it', async () => {
    const user = userEvent.setup();
    render(<TeamTab projectId="project-1" canGrantProjectAdmin={false} />);

    await user.click(await screen.findByRole('button', { name: /invite team member/i }));

    const roleSelect = screen.getByLabelText('Role');
    expect(within(roleSelect).queryByRole('option', { name: 'Admin' })).toBeNull();
    expect(within(roleSelect).getByRole('option', { name: 'Project Manager' })).toBeInTheDocument();

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/projects/project-1/users');
    });
  });

  it('offers Project Admin when the actor can grant it', async () => {
    const user = userEvent.setup();
    render(<TeamTab projectId="project-1" canGrantProjectAdmin />);

    await user.click(await screen.findByRole('button', { name: /invite team member/i }));

    expect(
      within(screen.getByLabelText('Role')).getByRole('option', { name: 'Admin' }),
    ).toBeInTheDocument();
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api';
import { TeamTab } from './TeamTab';

const apiFetchMock = vi.mocked(apiFetch);

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});

describe('TeamTab project member picker', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('adds an existing company user by selected user ID', async () => {
    const user = userEvent.setup();

    apiFetchMock.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === '/api/projects/project-1/users' && !options) {
        return { users: [] };
      }
      if (path === '/api/projects/project-1/assignable-users') {
        return {
          users: [
            {
              id: 'candidate-2',
              email: 'sam.foreman@example.com',
              fullName: 'Sam Foreman',
              roleInCompany: 'member',
            },
          ],
        };
      }
      if (path === '/api/projects/project-1/users' && options?.method === 'POST') {
        return {};
      }
      throw new Error(`Unexpected apiFetch call: ${String(path)}`);
    });

    render(<TeamTab projectId="project-1" />);

    await screen.findByText('No team members yet.');
    await user.click(screen.getByRole('button', { name: /add team member/i }));

    await screen.findByLabelText('Search company users');
    expect(screen.queryByLabelText('Email Address')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Search company users'), 'Sam');
    await user.selectOptions(screen.getByLabelText('Project member'), 'candidate-2');
    await user.click(screen.getByRole('button', { name: /add to project/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/projects/project-1/users', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'candidate-2',
          role: 'site_engineer',
        }),
      });
    });
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ProjectUsersPage } from './ProjectUsersPage';
import { apiFetch } from '@/lib/api';

const apiFetchMock = vi.mocked(apiFetch);
const toastMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { id: 'admin-user', email: 'admin@example.com' },
  }),
}));

vi.mock('@/components/ui/toaster', () => ({
  toast: toastMock,
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useParams: () => ({ projectId: 'project-1' }),
  };
});

describe('ProjectUsersPage project member picker', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    toastMock.mockReset();
  });

  it('assigns an existing company user by selected user ID', async () => {
    const user = userEvent.setup();

    apiFetchMock.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === '/api/projects/project-1/users' && !options) {
        return { users: [] };
      }
      if (path === '/api/projects/project-1/assignable-users') {
        return {
          users: [
            {
              id: 'candidate-1',
              email: 'jane.site@example.com',
              fullName: 'Jane Site',
              roleInCompany: 'member',
            },
          ],
        };
      }
      if (path === '/api/projects/project-1/users' && options?.method === 'POST') {
        return {
          projectUser: {
            id: 'membership-1',
            userId: 'candidate-1',
            email: 'jane.site@example.com',
            fullName: 'Jane Site',
            role: 'viewer',
            status: 'active',
          },
        };
      }
      throw new Error(`Unexpected apiFetch call: ${String(path)}`);
    });

    render(<ProjectUsersPage />);

    await screen.findByText('No team members yet');
    await user.click(screen.getByRole('button', { name: /invite first user/i }));

    await screen.findByLabelText('Search company users');
    expect(screen.queryByLabelText('Email Address')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Search company users'), 'Jane');
    await user.selectOptions(screen.getByLabelText('Project member'), 'candidate-1');
    await user.click(screen.getByRole('button', { name: /add to project/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/projects/project-1/users', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'candidate-1',
          role: 'viewer',
        }),
      });
    });
  });
});

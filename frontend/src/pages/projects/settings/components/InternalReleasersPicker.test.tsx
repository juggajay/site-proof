import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFetch } from '@/lib/api';
import { InternalReleasersPicker } from './InternalReleasersPicker';

const apiFetchMock = vi.mocked(apiFetch);

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});

const USERS = [
  {
    id: 'membership-1',
    userId: 'user-1',
    email: 'alex@example.com',
    fullName: 'Alex Quality',
    role: 'quality_manager',
    status: 'active',
  },
  {
    id: 'membership-2',
    userId: 'user-2',
    email: 'sam@example.com',
    fullName: 'Sam Site',
    role: 'site_manager',
    status: 'active',
  },
];

describe('InternalReleasersPicker', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('renders current members and optimistically adds and removes nominated releasers', async () => {
    const onSaved = vi.fn();
    apiFetchMock.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === '/api/projects/project-1/users' && !options) return { users: USERS };
      if (path === '/api/projects/project-1' && options?.method === 'PATCH') return { project: {} };
      throw new Error(`Unexpected request: ${path}`);
    });

    render(
      <InternalReleasersPicker
        projectId="project-1"
        initialSelectedIds={['user-1']}
        onSaved={onSaved}
      />,
    );

    const alex = await screen.findByRole('checkbox', {
      name: 'Nominated internal releaser: Alex Quality',
    });
    const sam = screen.getByRole('checkbox', {
      name: 'Nominated internal releaser: Sam Site',
    });
    expect(alex).toBeChecked();
    expect(sam).not.toBeChecked();

    await userEvent.click(sam);
    await waitFor(() => expect(onSaved).toHaveBeenLastCalledWith(['user-1', 'user-2']));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/api/projects/project-1', {
      method: 'PATCH',
      body: JSON.stringify({ hpInternalReleaserIds: ['user-1', 'user-2'] }),
    });

    await userEvent.click(alex);
    await waitFor(() => expect(onSaved).toHaveBeenLastCalledWith(['user-2']));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/api/projects/project-1', {
      method: 'PATCH',
      body: JSON.stringify({ hpInternalReleaserIds: ['user-2'] }),
    });
  });

  it('reverts the optimistic selection when persistence fails', async () => {
    apiFetchMock.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === '/api/projects/project-1/users' && !options) return { users: USERS };
      if (path === '/api/projects/project-1' && options?.method === 'PATCH') {
        throw new Error('Save failed');
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    render(<InternalReleasersPicker projectId="project-1" initialSelectedIds={['user-1']} />);

    const alex = await screen.findByRole('checkbox', {
      name: 'Nominated internal releaser: Alex Quality',
    });
    await userEvent.click(alex);

    await waitFor(() => expect(alex).toBeChecked());
    expect(screen.getByRole('alert')).toHaveTextContent('Save failed');
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api';
import { CompanyTeamMembersSection } from './CompanyTeamMembersSection';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});

const apiFetchMock = vi.mocked(apiFetch);

describe('CompanyTeamMembersSection', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('loads and displays active and pending company members', async () => {
    apiFetchMock.mockResolvedValueOnce({
      members: [
        {
          id: 'owner-1',
          email: 'owner@example.com',
          fullName: 'Owner User',
          roleInCompany: 'owner',
          hasPassword: true,
          status: 'active',
        },
        {
          id: 'pending-1',
          email: 'pending@example.com',
          fullName: 'Pending Foreman',
          roleInCompany: 'foreman',
          hasPassword: false,
          status: 'pending',
        },
      ],
    });

    render(<CompanyTeamMembersSection currentUserId="owner-1" />);

    await screen.findByText('Owner User');
    expect(screen.getByText('(you)')).toBeInTheDocument();
    expect(screen.getByText('Pending Foreman')).toBeInTheDocument();
    expect(screen.getByText('Foreman')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith('/api/company/members');
  });

  it('shows an actionable empty state', async () => {
    apiFetchMock.mockResolvedValueOnce({ members: [] });

    render(<CompanyTeamMembersSection />);

    await screen.findByText('No team members yet');
    expect(screen.getAllByRole('button', { name: 'Invite Member' })).toHaveLength(2);
  });

  it('invites a pending member and adds them to the table', async () => {
    apiFetchMock.mockResolvedValueOnce({ members: [] }).mockResolvedValueOnce({
      message: 'Company invitation sent successfully',
      member: {
        id: 'member-2',
        email: 'new.foreman@example.com',
        fullName: 'New Foreman',
        roleInCompany: 'foreman',
        hasPassword: false,
        status: 'pending',
      },
      invitation: {
        setupRequired: true,
        expiresAt: '2026-06-12T00:00:00.000Z',
      },
    });

    render(<CompanyTeamMembersSection />);

    await screen.findByText('No team members yet');
    fireEvent.click(screen.getAllByRole('button', { name: 'Invite Member' })[0]);

    fireEvent.change(screen.getByLabelText('Email *'), {
      target: { value: 'New.Foreman@Example.com' },
    });
    fireEvent.change(screen.getByLabelText('Full Name'), {
      target: { value: 'New Foreman' },
    });
    fireEvent.change(screen.getByLabelText('Company Role'), {
      target: { value: 'foreman' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/company/members/invite', {
        method: 'POST',
        body: JSON.stringify({
          email: 'new.foreman@example.com',
          fullName: 'New Foreman',
          roleInCompany: 'foreman',
        }),
      });
    });

    expect(
      await screen.findByText(
        "Invitation sent to new.foreman@example.com. They'll appear as pending until they set a password.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('New Foreman')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });
});

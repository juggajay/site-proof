import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { CompanyTeamMembersSection } from './CompanyTeamMembersSection';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});

const apiFetchMock = vi.mocked(apiFetch);

function renderWithQueryClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);

  return { queryClient, invalidateSpy };
}

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

    renderWithQueryClient(<CompanyTeamMembersSection currentUserId="owner-1" />);

    await screen.findByText('Owner User');
    expect(screen.getByText('(you)')).toBeInTheDocument();
    expect(screen.getByText('Pending Foreman')).toBeInTheDocument();
    expect(screen.getByText('Foreman')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith('/api/company/members');
  });

  it('shows an actionable empty state', async () => {
    apiFetchMock.mockResolvedValueOnce({ members: [] });

    renderWithQueryClient(<CompanyTeamMembersSection currentUserCompanyRole="owner" />);

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

    const { invalidateSpy } = renderWithQueryClient(
      <CompanyTeamMembersSection currentUserCompanyRole="owner" />,
    );

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
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.companySettings });
  });

  it('cancels a pending invitation and removes it from the table', async () => {
    apiFetchMock.mockResolvedValueOnce({
      members: [
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
    apiFetchMock.mockResolvedValueOnce({
      memberId: 'pending-1',
      status: 'cancelled',
    });

    const { invalidateSpy } = renderWithQueryClient(
      <CompanyTeamMembersSection currentUserCompanyRole="owner" />,
    );

    await screen.findByText('Pending Foreman');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Cancel Company Invitation')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Invitation' }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/company/members/pending-1', {
        method: 'DELETE',
      });
    });

    expect(await screen.findByText('Invitation cancelled for pending@example.com.')).toBeVisible();
    expect(screen.queryByText('Pending Foreman')).not.toBeInTheDocument();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.companySettings });
  });

  it('removes an active member and leaves protected rows without remove buttons', async () => {
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
          id: 'member-1',
          email: 'member@example.com',
          fullName: 'Active Member',
          roleInCompany: 'site_engineer',
          hasPassword: true,
          status: 'active',
        },
      ],
    });
    apiFetchMock.mockResolvedValueOnce({
      memberId: 'member-1',
      status: 'removed',
    });

    renderWithQueryClient(<CompanyTeamMembersSection currentUserId="owner-1" />);

    await screen.findByText('Owner User');
    expect(screen.getByText('You')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.getByText('Remove Company Member')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Member' }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/company/members/member-1', {
        method: 'DELETE',
      });
    });

    expect(await screen.findByText('Active Member was removed from the company.')).toBeVisible();
    expect(screen.queryByText('Active Member')).not.toBeInTheDocument();
  });

  it('offers a role select only for other non-owner members (H23)', async () => {
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
          id: 'admin-2',
          email: 'admin@example.com',
          fullName: 'Admin Two',
          roleInCompany: 'admin',
          hasPassword: true,
          status: 'active',
        },
        {
          id: 'member-1',
          email: 'member@example.com',
          fullName: 'Active Member',
          roleInCompany: 'site_engineer',
          hasPassword: true,
          status: 'active',
        },
      ],
    });

    renderWithQueryClient(<CompanyTeamMembersSection currentUserId="admin-2" />);
    await screen.findByText('Active Member');

    expect(
      screen.getByRole('combobox', { name: 'Change role for Active Member' }),
    ).toBeInTheDocument();
    // The owner's role and your own role are not editable here.
    expect(
      screen.queryByRole('combobox', { name: 'Change role for Owner User' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Change role for Admin Two' }),
    ).not.toBeInTheDocument();
  });

  it('hides owner-only member controls from non-owner company admins', async () => {
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
          id: 'admin-2',
          email: 'admin@example.com',
          fullName: 'Admin Two',
          roleInCompany: 'admin',
          hasPassword: true,
          status: 'active',
        },
        {
          id: 'admin-3',
          email: 'peer-admin@example.com',
          fullName: 'Peer Admin',
          roleInCompany: 'admin',
          hasPassword: true,
          status: 'active',
        },
        {
          id: 'member-1',
          email: 'member@example.com',
          fullName: 'Active Member',
          roleInCompany: 'site_engineer',
          hasPassword: true,
          status: 'active',
        },
      ],
    });

    renderWithQueryClient(
      <CompanyTeamMembersSection currentUserId="admin-2" currentUserCompanyRole="admin" />,
    );
    await screen.findByText('Active Member');

    expect(
      screen.queryByRole('combobox', { name: 'Change role for Peer Admin' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Peer Admin').closest('.grid')).toHaveTextContent('Owner only');

    const memberRoleSelect = screen.getByRole('combobox', {
      name: 'Change role for Active Member',
    });
    expect(
      within(memberRoleSelect).queryByRole('option', { name: 'Admin' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Invite Member' }));
    const inviteRoleSelect = screen.getByLabelText('Company Role');
    expect(
      within(inviteRoleSelect).queryByRole('option', { name: 'Admin' }),
    ).not.toBeInTheDocument();
  });

  it('changes a member role via PATCH and reflects the new role (H23)', async () => {
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
          id: 'member-1',
          email: 'member@example.com',
          fullName: 'Active Member',
          roleInCompany: 'site_engineer',
          hasPassword: true,
          status: 'active',
        },
      ],
    });
    apiFetchMock.mockResolvedValueOnce({
      message: 'Company member role updated successfully',
      member: { id: 'member-1', roleInCompany: 'project_manager' },
      previousRole: 'site_engineer',
    });

    renderWithQueryClient(<CompanyTeamMembersSection currentUserId="owner-1" />);
    await screen.findByText('Active Member');

    const select = screen.getByRole('combobox', {
      name: 'Change role for Active Member',
    }) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'project_manager' } });

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/company/members/member-1', {
        method: 'PATCH',
        body: JSON.stringify({ roleInCompany: 'project_manager' }),
      });
    });

    await waitFor(() => {
      expect(
        (
          screen.getByRole('combobox', {
            name: 'Change role for Active Member',
          }) as HTMLSelectElement
        ).value,
      ).toBe('project_manager');
    });
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProfileOverview } from './ProfileOverview';

describe('ProfileOverview', () => {
  it('renders the profile summary and formatted account metadata', () => {
    render(
      <ProfileOverview
        user={{
          email: 'foreman@example.com',
          fullName: 'Frank Foreman',
          phone: '+61 400 123 456',
          role: 'site_manager',
          companyName: 'SiteProof Civil',
          createdAt: '2026-05-01T00:00:00.000Z',
          avatarUrl: null,
        }}
        loggingOutAll={false}
        onChangePassword={() => {}}
        onEditProfile={() => {}}
        onLogoutAllDevices={() => {}}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Frank Foreman' })).toBeInTheDocument();
    expect(screen.getAllByText('foreman@example.com')).toHaveLength(2);
    expect(screen.getByText('+61 400 123 456')).toBeInTheDocument();
    expect(screen.getAllByText('Site Manager')).toHaveLength(2);
    expect(screen.getByText('SiteProof Civil')).toBeInTheDocument();
    expect(screen.getByText('1 May 2026')).toBeInTheDocument();
  });

  it('uses fallback labels for incomplete profile details', () => {
    render(
      <ProfileOverview
        user={{ email: 'new.user@example.com' }}
        loggingOutAll={false}
        onChangePassword={() => {}}
        onEditProfile={() => {}}
        onLogoutAllDevices={() => {}}
      />,
    );

    expect(screen.getByRole('heading', { name: 'new.user' })).toBeInTheDocument();
    expect(screen.getByText('N')).toBeInTheDocument();
    expect(screen.getByText('Not set')).toBeInTheDocument();
    expect(screen.getAllByText('User')).toHaveLength(2);
    expect(screen.getByText('No company assigned')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('wires account action callbacks and disabled logout state', () => {
    const onChangePassword = vi.fn();
    const onEditProfile = vi.fn();
    const onLogoutAllDevices = vi.fn();

    const { rerender } = render(
      <ProfileOverview
        user={{ email: 'admin@example.com' }}
        loggingOutAll={false}
        onChangePassword={onChangePassword}
        onEditProfile={onEditProfile}
        onLogoutAllDevices={onLogoutAllDevices}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));
    fireEvent.click(screen.getByRole('button', { name: 'Logout All Devices' }));

    expect(onChangePassword).toHaveBeenCalledTimes(1);
    expect(onEditProfile).toHaveBeenCalledTimes(1);
    expect(onLogoutAllDevices).toHaveBeenCalledTimes(1);

    rerender(
      <ProfileOverview
        user={{ email: 'admin@example.com' }}
        loggingOutAll
        onChangePassword={onChangePassword}
        onEditProfile={onEditProfile}
        onLogoutAllDevices={onLogoutAllDevices}
      />,
    );

    expect(screen.getByRole('button', { name: 'Logging out...' })).toBeDisabled();
  });

  it('hides the change-password action for passwordless accounts', () => {
    const onChangePassword = vi.fn();

    render(
      <ProfileOverview
        user={{ email: 'oauth@example.com', hasPassword: false }}
        loggingOutAll={false}
        onChangePassword={onChangePassword}
        onEditProfile={() => {}}
        onLogoutAllDevices={() => {}}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Change Password' })).not.toBeInTheDocument();
    expect(screen.getByText(/This account does not have a password yet/i)).toBeInTheDocument();
  });
});

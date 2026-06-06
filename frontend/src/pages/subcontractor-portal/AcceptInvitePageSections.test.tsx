import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import {
  AcceptInviteAlreadyAcceptedState,
  AcceptInviteErrorState,
  AcceptInviteFormError,
  AcceptInviteLoadingState,
  InvitationSummaryCard,
  PasswordRequirementsList,
} from './AcceptInvitePageSections';
import type { Invitation } from './AcceptInvitePage';

const invitation: Invitation = {
  id: 'invite-1',
  companyName: 'QA Civil Pty Ltd',
  projectName: 'North Road Upgrade',
  headContractorName: 'Head Contractor Co',
  primaryContactEmail: 'qa@example.com',
  status: 'pending',
};

function renderWithRouter(ui: ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('AcceptInvitePageSections', () => {
  it('renders the loading state', () => {
    render(<AcceptInviteLoadingState />);

    expect(screen.getByText('Loading invitation...')).toBeVisible();
  });

  it('renders the not-found state with login link', () => {
    renderWithRouter(<AcceptInviteErrorState error="This invitation was not found." />);

    expect(screen.getByText('Invitation Not Found')).toBeVisible();
    expect(screen.getByText('This invitation was not found.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Go to Login' })).toHaveAttribute('href', '/login');
  });

  it('routes accepted invites to the portal for logged-in users', () => {
    renderWithRouter(<AcceptInviteAlreadyAcceptedState isLoggedIn={true} />);

    expect(screen.getByText('Invitation Already Accepted')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Go to Portal' })).toHaveAttribute(
      'href',
      '/subcontractor-portal',
    );
  });

  it('renders the invitation summary details', () => {
    render(<InvitationSummaryCard invitation={invitation} />);

    expect(screen.getByText("You've been invited!")).toBeVisible();
    expect(screen.getByText('QA Civil Pty Ltd')).toBeVisible();
    expect(screen.getByText('North Road Upgrade')).toBeVisible();
    expect(screen.getByText('Head Contractor Co')).toBeVisible();
  });

  it('renders form errors and password requirements', () => {
    render(
      <>
        <AcceptInviteFormError message="Failed to accept invitation" />
        <PasswordRequirementsList
          minPasswordLength={12}
          checks={{
            minLength: true,
            hasUppercase: true,
            hasLowercase: false,
            hasNumber: true,
            hasSpecial: false,
          }}
        />
      </>,
    );

    expect(screen.getByText('Failed to accept invitation')).toBeVisible();
    expect(screen.getByText('✓ At least 12 characters')).toBeVisible();
    expect(screen.getByText('○ One lowercase letter')).toBeVisible();
    expect(screen.getByText('○ One special character')).toBeVisible();
  });
});

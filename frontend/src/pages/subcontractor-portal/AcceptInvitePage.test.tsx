import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';
import { ApiError } from '@/lib/api';
import type { Invitation } from './AcceptInvitePage';

// Hoisted mocks so the vi.mock factories (run before imports) can close over them.
const authState = vi.hoisted(() => ({
  user: { email: 'bob@gmail.com' } as { email: string } | null,
}));
const apiFetchMock = vi.hoisted(() => vi.fn());
const navigateMock = vi.hoisted(() => vi.fn());
const refreshUserMock = vi.hoisted(() => vi.fn<() => Promise<unknown>>());
const setTokenMock = vi.hoisted(() => vi.fn<() => Promise<unknown>>());
const signOutMock = vi.hoisted(() => vi.fn<() => Promise<void>>());

const ACCEPTED_SUBBIE_USER = {
  id: 'subbie-user-1',
  email: 'bob@gmail.com',
  role: 'subcontractor_admin',
  roleInCompany: 'subcontractor_admin',
  companyId: null,
  hasSubcontractorPortalAccess: true,
};

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: authState.user,
    loading: false,
    refreshUser: refreshUserMock,
    setToken: setTokenMock,
    signOut: signOutMock,
  }),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: apiFetchMock };
});

vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useSearchParams: () => [new URLSearchParams('id=invite-1'), vi.fn()],
  };
});

import { AcceptInvitePage } from './AcceptInvitePage';

const INVITATION: Invitation = {
  id: 'invite-1',
  companyName: 'QA Civil Pty Ltd',
  projectName: 'North Road Upgrade',
  headContractorName: 'Head Contractor Co',
  primaryContactEmail: 'bob@oldco.com',
  primaryContactName: 'Bob Builder',
  status: 'pending_approval',
};

function emailMismatchError() {
  return new ApiError(
    409,
    JSON.stringify({
      error: {
        message: "This invitation was sent to b***@oldco.com. You're signed in as bob@gmail.com.",
        code: 'EMAIL_MISMATCH',
        details: { invitedEmailMasked: 'b***@oldco.com' },
      },
    }),
  );
}

beforeEach(() => {
  apiFetchMock.mockReset();
  navigateMock.mockReset();
  refreshUserMock.mockReset();
  refreshUserMock.mockResolvedValue(ACCEPTED_SUBBIE_USER);
  setTokenMock.mockReset();
  setTokenMock.mockResolvedValue(ACCEPTED_SUBBIE_USER);
  signOutMock.mockReset();
  signOutMock.mockResolvedValue(undefined);
  authState.user = { email: 'bob@gmail.com' };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('AcceptInvitePage email-mismatch reconciliation', () => {
  it('offers confirmation on EMAIL_MISMATCH and accepts with the flag on the second attempt', async () => {
    const user = userEvent.setup();

    apiFetchMock.mockImplementation((url: string, options?: { body?: string }) => {
      if (url === '/api/subcontractors/invitation/invite-1') {
        return Promise.resolve({ invitation: INVITATION });
      }
      if (url === '/api/subcontractors/invitation/invite-1/accept') {
        const body = JSON.parse(options?.body ?? '{}') as { acknowledgeEmailMismatch?: boolean };
        if (!body.acknowledgeEmailMismatch) {
          return Promise.reject(emailMismatchError());
        }
        return Promise.resolve({ subcontractor: { ...INVITATION, status: 'approved' } });
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });

    renderWithProviders(<AcceptInvitePage />);

    // First accept attempt (no flag) surfaces the masked-email confirmation.
    const acceptButton = await screen.findByRole('button', { name: 'Accept Invitation' });
    await user.click(acceptButton);

    await screen.findByText(/This invitation was sent to/);
    expect(screen.getByText('b***@oldco.com')).toBeInTheDocument();
    expect(screen.getByText('bob@gmail.com')).toBeInTheDocument();
    // The full invited email must never be leaked to the signed-in account.
    expect(screen.queryByText('bob@oldco.com')).not.toBeInTheDocument();
    // Not yet navigated — we are blocked pending confirmation.
    expect(navigateMock).not.toHaveBeenCalled();

    // Confirm using the signed-in account -> re-POST with the acknowledge flag.
    await user.click(screen.getByRole('button', { name: 'Yes, accept with this account' }));

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/subcontractor-portal', { replace: true }),
    );

    const acceptCalls = apiFetchMock.mock.calls.filter(
      (call) => call[0] === '/api/subcontractors/invitation/invite-1/accept',
    );
    expect(acceptCalls).toHaveLength(2);
    expect(JSON.parse(acceptCalls[1][1].body)).toEqual({ acknowledgeEmailMismatch: true });
    expect(refreshUserMock).toHaveBeenCalledTimes(1);
  });

  it('accepts a matching-email invitation without showing the confirmation prompt', async () => {
    const user = userEvent.setup();

    apiFetchMock.mockImplementation((url: string) => {
      if (url === '/api/subcontractors/invitation/invite-1') {
        return Promise.resolve({
          invitation: { ...INVITATION, primaryContactEmail: 'bob@gmail.com' },
        });
      }
      if (url === '/api/subcontractors/invitation/invite-1/accept') {
        return Promise.resolve({ subcontractor: { ...INVITATION, status: 'approved' } });
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });

    renderWithProviders(<AcceptInvitePage />);

    const acceptButton = await screen.findByRole('button', { name: 'Accept Invitation' });
    await user.click(acceptButton);

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/subcontractor-portal', { replace: true }),
    );
    expect(screen.queryByText(/This invitation was sent to/)).not.toBeInTheDocument();
  });

  it('does not navigate with stale access when the session refresh fails after acceptance', async () => {
    const user = userEvent.setup();
    refreshUserMock.mockResolvedValue(null);

    apiFetchMock.mockImplementation((url: string) => {
      if (url === '/api/subcontractors/invitation/invite-1') {
        return Promise.resolve({
          invitation: { ...INVITATION, primaryContactEmail: 'bob@gmail.com' },
        });
      }
      if (url === '/api/subcontractors/invitation/invite-1/accept') {
        return Promise.resolve({ subcontractor: { ...INVITATION, status: 'approved' } });
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });

    renderWithProviders(<AcceptInvitePage />);

    const acceptButton = await screen.findByRole('button', { name: 'Accept Invitation' });
    await user.click(acceptButton);

    expect(
      await screen.findByText(/invitation accepted, but your session could not be refreshed/i),
    ).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('signs out before sending a signed-in user to login as a different account', async () => {
    const user = userEvent.setup();

    apiFetchMock.mockImplementation((url: string) => {
      if (url === '/api/subcontractors/invitation/invite-1') {
        return Promise.resolve({ invitation: INVITATION });
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });

    renderWithProviders(<AcceptInvitePage />);

    await screen.findByRole('button', { name: 'Accept Invitation' });
    await user.click(screen.getByRole('button', { name: 'Log in with a different account' }));

    await waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1));
    expect(navigateMock).toHaveBeenCalledWith(
      '/login?redirect=%2Fsubcontractor-portal%2Faccept-invite%3Fid%3Dinvite-1',
      { replace: true },
    );
  });
});

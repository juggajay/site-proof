import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';

// RegisterPage only needs signUp from the auth context here.
const signUpMock = vi.fn();
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ signUp: signUpMock }),
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

import { RegisterPage } from './RegisterPage';

const strongPassword = 'SecureP@ssword123!';

async function fillAndSubmitRegistration() {
  fireEvent.input(screen.getByLabelText(/first name/i), { target: { value: 'New' } });
  fireEvent.input(screen.getByLabelText(/last name/i), { target: { value: 'User' } });
  fireEvent.input(screen.getByLabelText(/^email$/i), {
    target: { value: 'new-user@example.com' },
  });
  fireEvent.input(screen.getByLabelText(/^password$/i), { target: { value: strongPassword } });
  fireEvent.input(screen.getByLabelText(/confirm password/i), {
    target: { value: strongPassword },
  });
  fireEvent.click(screen.getByRole('checkbox', { name: /agree/i }));
  fireEvent.click(screen.getByRole('button', { name: /create account/i }));
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('RegisterPage auto sign-in', () => {
  it('signs the new user straight in and lands on the app instead of the login form', async () => {
    // signUp resolves with the signed-in user when register returned a session.
    signUpMock.mockResolvedValue({
      id: 'new-user',
      email: 'new-user@example.com',
      emailVerified: false,
    });

    renderWithProviders(<RegisterPage />);
    await fillAndSubmitRegistration();

    // The freshly registered user never has to retype their password: they go
    // to /dashboard, where the company-onboarding gate forwards new accounts.
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/dashboard', { replace: true }));

    // No dead-stop success screen in the signed-in path.
    expect(screen.queryByRole('heading', { name: 'Account created' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /go to login/i })).not.toBeInTheDocument();
  });
});

describe('RegisterPage success screen (no-session fallback)', () => {
  it('tells the new user they can sign in now instead of implying they are blocked', async () => {
    // signUp resolves null when the account was created without a session.
    signUpMock.mockResolvedValue(null);

    renderWithProviders(<RegisterPage />);
    await fillAndSubmitRegistration();

    // Truth-first heading: the account exists, they are not waiting on an email.
    expect(await screen.findByRole('heading', { name: 'Account created' })).toBeInTheDocument();

    // The body must say sign-in is available now (no "verify before you can use it").
    expect(screen.getByText(/you can sign in now/i)).toBeInTheDocument();
    expect(screen.getByText(/new-user@example.com/)).toBeInTheDocument();

    // The misleading old copy must be gone.
    expect(screen.queryByRole('heading', { name: 'Check Your Email' })).not.toBeInTheDocument();
    expect(screen.queryByText(/click the link to verify your account/i)).not.toBeInTheDocument();

    // Both actions remain available, and nothing navigated away.
    expect(screen.getByRole('link', { name: /go to login/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /resend verification email/i })).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('does not show the success screen until registration succeeds', async () => {
    signUpMock.mockRejectedValue(new Error('Email already in use'));

    renderWithProviders(<RegisterPage />);
    await fillAndSubmitRegistration();

    await waitFor(() => expect(signUpMock).toHaveBeenCalled());
    expect(screen.queryByRole('heading', { name: 'Account created' })).not.toBeInTheDocument();
    expect(await screen.findByText('Email already in use')).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});

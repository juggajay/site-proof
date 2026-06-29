import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InviteSubcontractorModal } from './InviteSubcontractorModal';

const apiFetchMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  apiFetch: apiFetchMock,
}));

vi.mock('@/components/ui/toaster', () => ({
  toast: toastMock,
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}));

vi.mock('@/lib/abnValidation', () => ({
  validateABN: vi.fn(() => null),
  formatABN: vi.fn((value: string) => value),
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  apiFetchMock.mockReset();
  toastMock.mockReset();
  apiFetchMock.mockResolvedValue({ subcontractors: [] });
});

async function fillRequiredInviteFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/company name/i), 'Bad Phone Civil');
  await user.type(screen.getByLabelText(/primary contact name/i), 'Sam Contact');
}

describe('InviteSubcontractorModal', () => {
  it('blocks invalid contact email before calling invite API', async () => {
    const user = userEvent.setup();
    render(
      <InviteSubcontractorModal projectId="project-1" onClose={vi.fn()} onInvited={vi.fn()} />,
    );

    await fillRequiredInviteFields(user);
    await user.type(screen.getByLabelText(/email/i), 'not-an-email');

    const submit = screen.getByRole('button', { name: /create & send invitation/i });
    expect(submit).toBeDisabled();
    expect(screen.getByText('Enter a valid contact email.')).toBeInTheDocument();

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(1);
    });
    expect(apiFetchMock).toHaveBeenCalledWith('/api/subcontractors/directory');
  });

  it('blocks invalid optional phone before calling invite API', async () => {
    const user = userEvent.setup();
    render(
      <InviteSubcontractorModal projectId="project-1" onClose={vi.fn()} onInvited={vi.fn()} />,
    );

    await fillRequiredInviteFields(user);
    await user.type(screen.getByLabelText(/email/i), 'contact@example.com');
    await user.type(screen.getByLabelText(/phone/i), 'bad-phone');

    const submit = screen.getByRole('button', { name: /create & send invitation/i });
    expect(submit).toBeDisabled();
    expect(screen.getByText('Phone must be 3 to 40 digits or phone symbols.')).toBeInTheDocument();

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(1);
    });
    expect(apiFetchMock).toHaveBeenCalledWith('/api/subcontractors/directory');
  });
});

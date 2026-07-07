import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ComponentProps } from 'react';
import { NcrCreateModal } from './NcrModals';
import type { FailedTestForNcr } from '../types';

const useResponsiblePartyOptionsMock = vi.hoisted(() =>
  vi.fn(() => ({
    users: [
      { userId: 'user-1', label: 'Alex Chen' },
      { userId: 'user-2', label: 'Priya Singh' },
    ],
    subcontractors: [{ id: 'sub-1', label: 'Acme Earthworks' }],
    subcontractorsUnavailable: false,
    loading: false,
    error: null,
    retry: vi.fn(),
  })),
);

vi.mock('../../ncr/hooks/useResponsiblePartyOptions', () => ({
  useResponsiblePartyOptions: useResponsiblePartyOptionsMock,
}));

const failedTest: FailedTestForNcr = {
  testId: 'test-1',
  testType: 'Density Ratio',
  resultValue: '91',
  lotId: 'lot-1',
};

beforeEach(() => {
  vi.clearAllMocks();
  useResponsiblePartyOptionsMock.mockReturnValue({
    users: [
      { userId: 'user-1', label: 'Alex Chen' },
      { userId: 'user-2', label: 'Priya Singh' },
    ],
    subcontractors: [{ id: 'sub-1', label: 'Acme Earthworks' }],
    subcontractorsUnavailable: false,
    loading: false,
    error: null,
    retry: vi.fn(),
  });
});

function renderModal(props: Partial<ComponentProps<typeof NcrCreateModal>> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();

  render(
    <NcrCreateModal
      isOpen
      onClose={onClose}
      onSubmit={onSubmit}
      failedTestForNcr={failedTest}
      initialDescription="Failed Density Ratio result of 91"
      projectId="project-1"
      {...props}
    />,
  );

  return { onSubmit, onClose };
}

describe('NcrCreateModal', () => {
  it('loads and renders responsible-party options for the current project', () => {
    renderModal();

    expect(useResponsiblePartyOptionsMock).toHaveBeenCalledWith('project-1', true);
    expect(screen.getByRole('combobox', { name: 'Responsible Party' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Unassigned' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Alex Chen' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Acme Earthworks' })).toBeInTheDocument();
  });

  it('submits the selected user assignment', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderModal();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Responsible Party' }), [
      screen.getByRole('option', { name: 'Alex Chen' }),
    ]);
    await user.click(screen.getByRole('button', { name: 'Raise NCR' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.responsibleUserId).toBe('user-1');
    expect(payload).not.toHaveProperty('responsibleSubcontractorId');
  });

  it('submits the selected subcontractor assignment', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderModal();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Responsible Party' }), [
      screen.getByRole('option', { name: 'Acme Earthworks' }),
    ]);
    await user.click(screen.getByRole('button', { name: 'Raise NCR' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.responsibleSubcontractorId).toBe('sub-1');
    expect(payload).not.toHaveProperty('responsibleUserId');
  });

  it('submits without responsible-party fields when left unassigned', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Raise NCR' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    const payload = onSubmit.mock.calls[0][0];
    expect(payload).not.toHaveProperty('responsibleUserId');
    expect(payload).not.toHaveProperty('responsibleSubcontractorId');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/renderWithProviders';
import { ConcessionModal } from './ConcessionModal';
import type { NCR } from '../types';

const majorNcr = {
  id: 'ncr-1',
  ncrNumber: 'NCR-001',
  description: 'Cover to reinforcement below spec',
  severity: 'major',
} as unknown as NCR;

describe('ConcessionModal (H9)', () => {
  it('submits the client approval reference under clientApprovalReference for a major concession', async () => {
    const onSubmit = vi.fn();

    renderWithProviders(
      <ConcessionModal
        isOpen
        ncr={majorNcr}
        onClose={() => {}}
        onSubmit={onSubmit}
        loading={false}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/cannot be fully rectified/i), {
      target: { value: 'Rework would compromise adjacent pour' },
    });
    fireEvent.change(screen.getByPlaceholderText(/risk implications/i), {
      target: { value: 'Low residual structural risk after engineering review' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Email ref, Letter ID/i), {
      target: { value: 'RFI-204' },
    });
    fireEvent.click(screen.getByRole('checkbox'));

    fireEvent.click(screen.getByRole('button', { name: /Close with Concession/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        'ncr-1',
        expect.objectContaining({ clientApprovalReference: 'RFI-204' }),
      );
    });
  });

  it('keeps submit disabled for a major concession until a client approval reference is entered', () => {
    renderWithProviders(
      <ConcessionModal
        isOpen
        ncr={majorNcr}
        onClose={() => {}}
        onSubmit={vi.fn()}
        loading={false}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/cannot be fully rectified/i), {
      target: { value: 'Rework not feasible' },
    });
    fireEvent.change(screen.getByPlaceholderText(/risk implications/i), {
      target: { value: 'Low risk' },
    });
    fireEvent.click(screen.getByRole('checkbox'));

    // Reference still blank -> the close button stays disabled.
    expect(screen.getByRole('button', { name: /Close with Concession/i })).toBeDisabled();
  });
});

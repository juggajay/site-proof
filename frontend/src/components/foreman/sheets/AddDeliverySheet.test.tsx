/**
 * C5-a — the SECOND mount of the shared docket control.
 *
 * The diary page's delivery sheet and the shell's DeliveryFormScreen are two
 * different screens over one action, and before this they diverged: only one of
 * them could carry a docket. These assert the sheet is capture-first with the
 * same control, and that it files against the id the save returned — the same
 * contract the shell mount is held to, in the same words.
 */

import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

const mockQueueDeliveryDocket = vi.fn().mockResolvedValue({ id: 'ph-1' });
vi.mock('@/components/deliveries/queueDeliveryDocket', () => ({
  queueDeliveryDocket: (...args: unknown[]) => mockQueueDeliveryDocket(...args),
}));

import { AddDeliverySheet } from './AddDeliverySheet';

const LOTS = [{ id: 'lot-1', lotNumber: '001' }];

function renderSheet(
  overrides: Partial<ComponentProps<typeof AddDeliverySheet>> = {},
  onSave: (data: unknown) => Promise<string | undefined> = vi.fn().mockResolvedValue('srv-del-1'),
) {
  const onClose = vi.fn();
  const view = renderWithProviders(
    <AddDeliverySheet
      isOpen
      onClose={onClose}
      onSave={onSave}
      projectId="proj-1"
      defaultLotId={null}
      lots={LOTS}
      {...overrides}
    />,
  );
  return { ...view, onClose, onSave };
}

function docketFile() {
  return new File(['x'], 'docket.jpg', { type: 'image/jpeg' });
}

describe('AddDeliverySheet — docket capture (second mount)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueueDeliveryDocket.mockResolvedValue({ id: 'ph-1' });
  });

  it('is capture-first: the docket button is present and the typed detail is disclosed', () => {
    renderSheet();

    expect(screen.getByRole('button', { name: /Photograph docket/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Supplier name')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Supplier \/ docket no\. \/ quantity/i }));
    expect(screen.getByPlaceholderText('Supplier name')).toBeInTheDocument();
  });

  it('queues the docket against the delivery id onSave resolved with', async () => {
    const onSave = vi.fn().mockResolvedValue('srv-del-9');
    renderSheet({}, onSave);

    fireEvent.change(screen.getByPlaceholderText('What was delivered?'), {
      target: { value: '84t Type 2.1' },
    });
    fireEvent.change(screen.getByTestId('docket-camera-input'), {
      target: { files: [docketFile()] },
    });
    await screen.findByText('Docket photo');

    fireEvent.click(screen.getByRole('button', { name: /Save Delivery/i }));

    await waitFor(() => {
      expect(mockQueueDeliveryDocket).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'proj-1', deliveryId: 'srv-del-9' }),
      );
    });
  });

  it('does not offer capture without a project to file the docket into', () => {
    renderSheet({ projectId: undefined });
    expect(screen.queryByRole('button', { name: /Photograph docket/i })).not.toBeInTheDocument();
  });

  it('saves with no docket at all — capture is never a precondition', async () => {
    const onSave = vi.fn().mockResolvedValue('srv-del-2');
    renderSheet({}, onSave);

    fireEvent.change(screen.getByPlaceholderText('What was delivered?'), {
      target: { value: 'Sika Plastiment retarder' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Delivery/i }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Sika Plastiment retarder' }),
      ),
    );
    expect(mockQueueDeliveryDocket).not.toHaveBeenCalled();
  });
});

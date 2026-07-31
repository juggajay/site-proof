/**
 * C5-a — the third mount, and the one that carries the wave's whole premise:
 * a docket can still be filed after the diary is locked.
 *
 * The copy rules are asserted, not just the plumbing. "Not filed in CIVOS"
 * rather than "NO DOCKET" (the docket usually exists — on paper, in a ute — and
 * what is missing is the filing), and nothing anywhere claims the docket is
 * filed while it is still on the phone.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@/components/foreman/sheets/BottomSheet', () => ({
  BottomSheet: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      <h2>{title}</h2>
      {children}
    </div>
  ),
}));

vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));

const retryFailedSyncs = vi.fn().mockResolvedValue(undefined);
const syncPendingChanges = vi.fn().mockResolvedValue(undefined);
let _isOnline = true;
vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: () => ({
    isOnline: _isOnline,
    pendingSyncCount: 0,
    failedSyncCount: 0,
    isSyncing: false,
    retryFailedSyncs,
    syncPendingChanges,
  }),
}));

const deleteOfflinePhoto = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/offlineDb', () => ({
  deleteOfflinePhoto: (...args: unknown[]) => deleteOfflinePhoto(...args),
}));

const mockQueueDeliveryDocket = vi.fn().mockResolvedValue({ id: 'ph-1' });
vi.mock('./queueDeliveryDocket', () => ({
  queueDeliveryDocket: (...args: unknown[]) => mockQueueDeliveryDocket(...args),
}));

import { DeliveryEvidenceSheet } from './DeliveryEvidenceSheet';

const DELIVERY = {
  id: 'srv-del-1',
  description: 'Type 2.1 subbase',
  supplier: 'Hanson Quarry Narangba',
  docketNumber: 'HQN-55210',
  quantity: 84,
  unit: 't',
  lotLabel: 'Lot 014',
  docketDocumentId: null as string | null,
};

function renderSheet(over: Partial<React.ComponentProps<typeof DeliveryEvidenceSheet>> = {}) {
  const onClose = vi.fn();
  render(
    <DeliveryEvidenceSheet
      isOpen
      onClose={onClose}
      projectId="proj-1"
      delivery={DELIVERY}
      {...over}
    />,
  );
  return { onClose };
}

function docketFile() {
  return new File(['x'], 'docket.jpg', { type: 'image/jpeg' });
}

describe('DeliveryEvidenceSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _isOnline = true;
    mockQueueDeliveryDocket.mockResolvedValue({ id: 'ph-1' });
  });

  it('states what was recorded and that only the docket is missing', () => {
    renderSheet();

    expect(screen.getByText('Hanson Quarry Narangba')).toBeInTheDocument();
    expect(screen.getByText('84 t')).toBeInTheDocument();
    expect(screen.getByText(/Not filed in CIVOS/)).toBeInTheDocument();
    // The accusatory framing this wave deliberately refuses.
    expect(screen.queryByText(/NO DOCKET/i)).not.toBeInTheDocument();
  });

  it('cannot file until a photo is actually chosen', () => {
    renderSheet();
    expect(screen.getByRole('button', { name: 'File docket' })).toBeDisabled();
  });

  it('queues the chosen docket against this delivery and never reports it filed', async () => {
    const { onClose } = renderSheet();

    fireEvent.change(screen.getByTestId('docket-gallery-input'), {
      target: { files: [docketFile()] },
    });
    await screen.findByText('Docket photo');

    fireEvent.click(screen.getByRole('button', { name: 'File docket' }));

    await waitFor(() =>
      expect(mockQueueDeliveryDocket).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'proj-1', deliveryId: 'srv-del-1' }),
      ),
    );
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByText('Docket filed')).not.toBeInTheDocument();
  });

  // The state the mock calls out by name: the file is up, the link is not.
  it('a failed filing offers a retry and says nothing is lost', () => {
    renderSheet({
      queuedPhoto: {
        id: 'ph-1',
        syncStatus: 'error',
        dataUrl: 'data:image/jpeg;base64,abc',
      } as never,
    });

    expect(screen.getByText(/nothing is lost/i)).toBeInTheDocument();
    expect(screen.getByText('Filing failed')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Try filing again/i }));
    expect(retryFailedSyncs).toHaveBeenCalled();
  });

  it('a queued docket with no signal reads "Saved on device", not filed', () => {
    _isOnline = false;
    renderSheet({
      queuedPhoto: {
        id: 'ph-1',
        syncStatus: 'pending',
        dataUrl: 'data:image/jpeg;base64,abc',
      } as never,
    });

    expect(screen.getByText('Saved on device')).toBeInTheDocument();
    expect(screen.queryByText('Docket filed')).not.toBeInTheDocument();
  });

  it('offers no capture once the server has confirmed the evidence link', () => {
    renderSheet({ delivery: { ...DELIVERY, docketDocumentId: 'doc-1' } });

    expect(screen.queryByRole('button', { name: /Photograph docket/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'File docket' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Not filed in CIVOS/)).not.toBeInTheDocument();
  });

  it('removing a queued docket deletes it from the device queue', async () => {
    renderSheet({
      queuedPhoto: {
        id: 'ph-1',
        syncStatus: 'pending',
        dataUrl: 'data:image/jpeg;base64,abc',
      } as never,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Remove docket photo' }));
    await waitFor(() => expect(deleteOfflinePhoto).toHaveBeenCalledWith('ph-1'));
  });
});

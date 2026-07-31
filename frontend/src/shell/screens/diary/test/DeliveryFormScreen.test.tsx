/**
 * C5-a — the canonical capture-first mount (/m/diary/work/delivery).
 *
 * Two things are load-bearing and asserted here:
 *   - the docket capture sits ABOVE the fold, with supplier / docket number /
 *     quantity behind the disclosure. Capture-first is the whole design: the
 *     foreman's hands are full and the photo is the evidence, the typed fields
 *     are a transcription of it.
 *   - the photo is queued against the id the SAVE returned, not before it. A
 *     docket queued against nothing is a file that can never be filed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOnline: true, pendingSyncCount: 0, isSyncing: false }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('@/hooks/useEffectiveProjectId', () => ({
  useEffectiveProjectId: () => ({ projectId: 'proj-1', isResolving: false }),
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

const mockQueueDeliveryDocket = vi.fn().mockResolvedValue({ id: 'ph-1' });
vi.mock('@/components/deliveries/queueDeliveryDocket', () => ({
  queueDeliveryDocket: (...args: unknown[]) => mockQueueDeliveryDocket(...args),
}));

const mockAddDelivery = vi.fn().mockResolvedValue('srv-del-1');

vi.mock('../useDiaryShellData', () => ({
  useDiaryShellData: () => ({
    diary: null,
    loading: false,
    lots: [],
    timeline: [],
    handlers: {
      activeLotId: null,
      addDeliveryFromSheet: mockAddDelivery,
      setEditingEntry: vi.fn(),
    },
  }),
}));

vi.mock('../../components/ShellScreen', () => ({
  ShellScreen: ({ children, bottom }: { children: React.ReactNode; bottom?: React.ReactNode }) => (
    <div>
      <main>{children}</main>
      {bottom}
    </div>
  ),
}));

vi.mock('@/components/foreman/sheets/useSheetDraft', () => ({
  useSheetDraft: () => ({
    draftHintVisible: false,
    dismissDraftHint: vi.fn(),
    clearDraft: vi.fn(),
    discardDraft: vi.fn(),
  }),
  readSheetDraft: () => null,
  sheetDraftKey: () => 'test-key',
}));

vi.mock('@/lib/localDate', () => ({ formatDateKey: () => '2026-06-11' }));

import { DeliveryFormScreen } from '../DeliveryFormScreen';

function renderScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/m/diary/work/delivery']}>
        <Routes>
          <Route path="/m/diary/work/delivery" element={<DeliveryFormScreen />} />
          <Route path="/m/diary/work" element={<div>work</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function docketFile() {
  return new File(['x'], 'docket.jpg', { type: 'image/jpeg' });
}

describe('DeliveryFormScreen — docket capture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddDelivery.mockResolvedValue('srv-del-1');
    mockQueueDeliveryDocket.mockResolvedValue({ id: 'ph-1' });
  });

  it('offers the docket capture above the fold and hides the typed detail behind the disclosure', () => {
    renderScreen();

    expect(screen.getByRole('button', { name: /Photograph docket/i })).toBeInTheDocument();
    // Supplier is a transcription of the docket, not the primary action.
    expect(screen.queryByPlaceholderText('Supplier name')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Supplier \/ docket no\. \/ quantity/i }));
    expect(screen.getByPlaceholderText('Supplier name')).toBeInTheDocument();
  });

  it('saves the delivery WITHOUT a docket — the photo is never a precondition', async () => {
    renderScreen();
    fireEvent.change(screen.getByPlaceholderText(/50T of crushed rock/i), {
      target: { value: 'Type 2.1 subbase' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save delivery/i }));

    await waitFor(() => {
      expect(mockAddDelivery).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Type 2.1 subbase' }),
      );
    });
    expect(mockQueueDeliveryDocket).not.toHaveBeenCalled();
  });

  it('queues the captured docket against the delivery id the save returned', async () => {
    renderScreen();
    fireEvent.change(screen.getByPlaceholderText(/50T of crushed rock/i), {
      target: { value: '32 MPa concrete' },
    });
    fireEvent.change(screen.getByTestId('docket-camera-input'), {
      target: { files: [docketFile()] },
    });

    // The captured photo replaces the button with its card.
    await screen.findByText('Docket photo');
    fireEvent.click(screen.getByRole('button', { name: /Save delivery/i }));

    await waitFor(() => {
      expect(mockQueueDeliveryDocket).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'proj-1', deliveryId: 'srv-del-1' }),
      );
    });
  });

  it('a docket that cannot be queued does not lose the delivery', async () => {
    mockQueueDeliveryDocket.mockRejectedValue(new Error('Dexie is blocked'));
    renderScreen();
    fireEvent.change(screen.getByPlaceholderText(/50T of crushed rock/i), {
      target: { value: 'Geofabric bidim A34' },
    });
    fireEvent.change(screen.getByTestId('docket-camera-input'), {
      target: { files: [docketFile()] },
    });
    await screen.findByText('Docket photo');
    fireEvent.click(screen.getByRole('button', { name: /Save delivery/i }));

    await waitFor(() => expect(mockQueueDeliveryDocket).toHaveBeenCalled());
    // The entry itself still went in; the row will honestly read "not filed".
    expect(mockAddDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Geofabric bidim A34' }),
    );
  });

  it('removing the captured docket returns the capture button', async () => {
    renderScreen();
    fireEvent.change(screen.getByTestId('docket-camera-input'), {
      target: { files: [docketFile()] },
    });
    await screen.findByText('Docket photo');

    fireEvent.click(screen.getByRole('button', { name: 'Remove docket photo' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Photograph docket/i })).toBeInTheDocument(),
    );
  });
});

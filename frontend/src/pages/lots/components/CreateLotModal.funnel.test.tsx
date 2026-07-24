import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Telemetry is the unit under test — capture the calls.
vi.mock('@/lib/productEvents', () => ({ trackEvent: vi.fn() }));

// Keep the modal off the network + AI/template machinery. Preserve the real
// module (ApiError etc. are used by errorHandling) and override only apiFetch.
vi.mock('@/lib/api', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/api')>();
  return {
    ...actual,
    apiFetch: vi.fn((path: string, options?: { method?: string }) => {
      if (path.includes('/api/lots/suggest-number')) {
        return Promise.resolve({ suggestedNumber: 'LOT-001' });
      }
      if (path.includes('/api/itp/templates')) {
        return Promise.resolve({ templates: [] });
      }
      if (path === '/api/lots' && options?.method === 'POST') {
        return Promise.resolve({ lot: { id: 'lot-1', lotNumber: 'LOT-001' } });
      }
      return Promise.resolve({});
    }),
  };
});
vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));
vi.mock('@/hooks/useAiStatus', () => ({ useAiStatus: () => ({ aiConfigured: false }) }));
vi.mock('@/lib/itpTemplateMatch', () => ({
  useTemplateMatch: () => ({ data: undefined }),
  useTemplateRank: () => ({ data: undefined }),
  resolveRankedMatch: () => ({ match: null, reasons: {} }),
  splitSuggestedTemplates: () => ({ suggested: [], rest: [] }),
}));

import { trackEvent } from '@/lib/productEvents';
import { CreateLotModal } from './CreateLotModal';

function renderModal() {
  return render(
    <CreateLotModal
      isOpen
      onClose={vi.fn()}
      onSuccess={vi.fn()}
      projectId="project-1"
      canViewBudgets={false}
    />,
  );
}

describe('CreateLotModal lot-create funnel', () => {
  it('fires opened on open, then submitted + succeeded on a successful create', async () => {
    renderModal();

    await waitFor(() => expect(trackEvent).toHaveBeenCalledWith('lot_create.opened'));

    // The suggested lot number populates asynchronously after the lookup.
    const lotInput = (await screen.findByPlaceholderText('e.g., LOT-001')) as HTMLInputElement;
    await waitFor(() => expect(lotInput.value).toBe('LOT-001'));

    fireEvent.submit(document.getElementById('create-lot-form')!);

    await waitFor(() =>
      expect(trackEvent).toHaveBeenCalledWith('lot_create.submitted', undefined, {
        activityType: expect.any(String),
      }),
    );
    await waitFor(() =>
      expect(trackEvent).toHaveBeenCalledWith(
        'lot_create.succeeded',
        undefined,
        expect.objectContaining({ activityType: expect.any(String), usedSuggestedTemplate: false }),
      ),
    );
    expect(trackEvent).not.toHaveBeenCalledWith(
      'lot_create.failed',
      expect.anything(),
      expect.anything(),
    );
  });

  it('fires failed when the create request rejects', async () => {
    const api = await import('@/lib/api');
    vi.mocked(api.apiFetch).mockImplementation((path: string, options?: { method?: string }) => {
      if (path.includes('/api/lots/suggest-number')) {
        return Promise.resolve({ suggestedNumber: 'LOT-001' } as never);
      }
      if (path.includes('/api/itp/templates')) {
        return Promise.resolve({ templates: [] } as never);
      }
      if (path === '/api/lots' && options?.method === 'POST') {
        return Promise.reject(new Error('boom'));
      }
      return Promise.resolve({} as never);
    });

    renderModal();
    const lotInput = (await screen.findByPlaceholderText('e.g., LOT-001')) as HTMLInputElement;
    await waitFor(() => expect(lotInput.value).toBe('LOT-001'));

    fireEvent.submit(document.getElementById('create-lot-form')!);

    await waitFor(() =>
      expect(trackEvent).toHaveBeenCalledWith('lot_create.failed', undefined, {
        activityType: expect.any(String),
      }),
    );
  });
});

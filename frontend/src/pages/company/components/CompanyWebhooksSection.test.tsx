import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api';
import { CompanyWebhooksSection } from './CompanyWebhooksSection';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});

const apiFetchMock = vi.mocked(apiFetch);

const list = {
  webhooks: [
    {
      id: 'wh-1',
      url: 'https://example.com/hook',
      events: ['*'],
      enabled: true,
      createdAt: '2026-06-01T00:00:00.000Z',
    },
  ],
};

beforeEach(() => {
  apiFetchMock.mockReset();
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});

describe('CompanyWebhooksSection', () => {
  it('lists webhooks with status and events', async () => {
    apiFetchMock.mockResolvedValueOnce(list);

    render(<CompanyWebhooksSection />);

    await screen.findByText('https://example.com/hook');
    expect(screen.getByText('Enabled')).toBeInTheDocument();
    expect(screen.getByText('All events')).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith('/api/webhooks');
  });

  it('creates a webhook and reveals the signing secret once', async () => {
    apiFetchMock.mockResolvedValueOnce({ webhooks: [] });
    apiFetchMock.mockResolvedValueOnce({
      id: 'wh-new',
      url: 'https://new.example.com',
      secret: 'whsec_revealed_once',
      events: ['*'],
      enabled: true,
      createdAt: '2026-06-21T00:00:00.000Z',
      message: 'created',
    });
    apiFetchMock.mockResolvedValueOnce(list);

    render(<CompanyWebhooksSection />);
    await screen.findByText(/No webhooks yet/);

    fireEvent.click(screen.getByRole('button', { name: /Add webhook/ }));
    fireEvent.change(screen.getByLabelText('Endpoint URL'), {
      target: { value: 'https://new.example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add webhook' }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/webhooks', {
        method: 'POST',
        body: JSON.stringify({ url: 'https://new.example.com', events: ['*'] }),
      });
    });

    expect(await screen.findByText('whsec_revealed_once')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copy to clipboard' }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('whsec_revealed_once');
    });
  });

  it('toggles a webhook enabled state via PATCH', async () => {
    apiFetchMock.mockResolvedValueOnce(list);
    apiFetchMock.mockResolvedValueOnce({ ...list.webhooks[0], enabled: false });

    render(<CompanyWebhooksSection />);
    await screen.findByText('https://example.com/hook');

    fireEvent.click(screen.getByRole('button', { name: 'Disable' }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/webhooks/wh-1', {
        method: 'PATCH',
        body: JSON.stringify({ enabled: false }),
      });
    });
    expect(await screen.findByRole('button', { name: 'Enable' })).toBeInTheDocument();
  });

  it('regenerates the signing secret and reveals it', async () => {
    apiFetchMock.mockResolvedValueOnce(list);
    apiFetchMock.mockResolvedValueOnce({ id: 'wh-1', secret: 'whsec_new', message: 'rotated' });

    render(<CompanyWebhooksSection />);
    await screen.findByText('https://example.com/hook');

    fireEvent.click(screen.getByRole('button', { name: 'Regenerate secret' }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/webhooks/wh-1/regenerate-secret', {
        method: 'POST',
      });
    });
    expect(await screen.findByText('whsec_new')).toBeInTheDocument();
  });

  it('deletes a webhook', async () => {
    apiFetchMock.mockResolvedValueOnce(list);
    apiFetchMock.mockResolvedValueOnce({ message: 'deleted' });

    render(<CompanyWebhooksSection />);
    await screen.findByText('https://example.com/hook');

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/webhooks/wh-1', { method: 'DELETE' });
    });
    await waitFor(() => {
      expect(screen.queryByText('https://example.com/hook')).not.toBeInTheDocument();
    });
  });
});

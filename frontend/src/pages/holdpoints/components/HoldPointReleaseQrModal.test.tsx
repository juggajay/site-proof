/**
 * Benchmark T2 — the QR release dialog.
 *
 * What matters here: the dialog mints a link through the authenticated
 * endpoint (the raw token is never readable from anywhere else), renders it as
 * a QR, and tells the operator whose approval the link records before they hand
 * the screen over.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api';
import { generateQrSvg } from '@/lib/qrCode';
import { HoldPointReleaseQrModal } from './HoldPointReleaseQrModal';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});

vi.mock('@/lib/qrCode', () => ({
  generateQrSvg: vi.fn(async (text: string) => `<svg data-encoded="${text}"></svg>`),
  escapeHtml: (value: string) => value,
}));

const apiFetchMock = vi.mocked(apiFetch);

beforeEach(() => {
  apiFetchMock.mockReset();
});

function renderModal() {
  return render(
    <HoldPointReleaseQrModal
      holdPointId="hp-1"
      lotNumber="LOT-001"
      description="Subgrade proof roll"
      onClose={vi.fn()}
    />,
  );
}

describe('HoldPointReleaseQrModal', () => {
  it('mints a link and encodes exactly that URL into the QR code', async () => {
    apiFetchMock.mockResolvedValue({
      releaseUrl: 'https://civos.test/hp-release/abc123',
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      recipientEmail: 'super@example.com',
      recipientName: 'Amos Soo',
    } as never);

    renderModal();

    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith('/api/holdpoints/hp-1/release-link', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    );

    // The URL is shown for anyone who would rather send it than have it scanned…
    await screen.findByText('https://civos.test/hp-release/abc123');
    // …and it is the same URL the QR encodes.
    expect(vi.mocked(generateQrSvg)).toHaveBeenCalledWith(
      'https://civos.test/hp-release/abc123',
      expect.any(Number),
    );
  });

  it('names the authority the link records the release as', async () => {
    apiFetchMock.mockResolvedValue({
      releaseUrl: 'https://civos.test/hp-release/abc123',
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      recipientEmail: 'super@example.com',
      recipientName: 'Amos Soo',
    } as never);

    renderModal();

    expect(await screen.findByText('Amos Soo')).toBeInTheDocument();
    expect(screen.getByText(/expires in \d+ minutes? and can be used once/i)).toBeInTheDocument();
  });

  it('falls back to the recipient email when the link carries no name', async () => {
    apiFetchMock.mockResolvedValue({
      releaseUrl: 'https://civos.test/hp-release/abc123',
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      recipientEmail: 'super@example.com',
      recipientName: null,
    } as never);

    renderModal();

    expect(await screen.findByText('super@example.com')).toBeInTheDocument();
  });

  it('reports the reason a link could not be minted instead of an empty frame', async () => {
    apiFetchMock.mockRejectedValue(
      new Error(
        'Request the release first — the release request is what records who may approve this hold point.',
      ) as never,
    );

    renderModal();

    expect(await screen.findByRole('alert')).toHaveTextContent(/Request the release first/i);
  });
});

// Wave D `D1b` — the lot page's evidence-folio surface (spec §9).
//
// Two properties worth a test: the issuer gate is a role gate on the
// SERVER-derived role, and issuance sends EMPTY bodies — the client contributes
// no `sha256`, no `compiledFrom` and no bytes (`[DH-i]`, **AT-124**). The copy
// guard is the third: the section must never claim certification or submission
// (`[DH-B8]`, **AT-136**).

import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EvidenceFolioSection } from './EvidenceFolioSection';

const apiFetchMock = vi.hoisted(() => vi.fn());
const authFetchMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ apiFetch: apiFetchMock, authFetch: authFetchMock }));
vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));

const FOLIO = {
  id: 'folio-1',
  version: 2,
  issuedAt: '2026-07-28T02:00:00.000Z',
  sha256: 'a'.repeat(64),
  fileSize: 5600,
  lotStatusAtIssue: 'conformed',
  issuedBy: { id: 'u1', name: 'Jayson Ryan' },
};

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function renderSection(effectiveRole: string, folios = [FOLIO]) {
  apiFetchMock.mockImplementation((path: string) => {
    if (path.endsWith('/folios')) return Promise.resolve({ folios });
    if (path.endsWith('/folio/sessions')) return Promise.resolve({ folioIssueId: FOLIO.id });
    return Promise.resolve(FOLIO);
  });
  const Wrapper = wrapper();
  return render(
    <Wrapper>
      <EvidenceFolioSection
        lotId="lot-1"
        lotNumber="LOT-014"
        effectiveRole={effectiveRole}
        canIssueFolio={['owner', 'admin', 'project_manager', 'quality_manager'].includes(
          effectiveRole,
        )}
      />
    </Wrapper>,
  );
}

describe('EvidenceFolioSection', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    authFetchMock.mockReset();
  });

  it('shows the issue action to an issuer role and hides it from a viewer', async () => {
    renderSection('quality_manager');
    expect(await screen.findByRole('button', { name: /issue folio/i })).toBeInTheDocument();

    renderSection('viewer');
    await waitFor(() => expect(screen.getAllByText(/Evidence folio/i).length).toBe(2));
    expect(screen.queryAllByRole('button', { name: /issue folio/i })).toHaveLength(1);
  });

  it('issues by POSTing two EMPTY bodies — the client supplies nothing (**AT-124**)', async () => {
    renderSection('project_manager');
    await userEvent.click(await screen.findByRole('button', { name: /issue folio/i }));

    await waitFor(() =>
      expect(
        apiFetchMock.mock.calls.filter(([, options]) => options?.method === 'POST'),
      ).toHaveLength(2),
    );
    const posts = apiFetchMock.mock.calls.filter(([, options]) => options?.method === 'POST');
    expect(posts.map(([path]) => path)).toEqual([
      '/api/lots/lot-1/folio/sessions',
      `/api/folios/${FOLIO.id}/issue`,
    ]);
    // No sha256, no compiledFrom, no bytes — the server owns all of it, and
    // sending any of them would be a 400 rather than a silently stripped key.
    for (const [, options] of posts) {
      expect(JSON.parse(options.body as string)).toEqual({});
    }
  });

  it('lists version, issue time, issuer and checksum', async () => {
    renderSection('owner');
    expect(await screen.findByText('v2')).toBeInTheDocument();
    expect(screen.getByText(/Jayson Ryan/)).toBeInTheDocument();
    expect(screen.getByText(/SHA-256 aaaaaaaaaaaaaaaa/)).toBeInTheDocument();
  });

  it('downloads through the authenticated backend route, never a storage URL', async () => {
    authFetchMock.mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(['pdf'])) });
    renderSection('owner');
    await userEvent.click(await screen.findByRole('button', { name: /download/i }));
    await waitFor(() => expect(authFetchMock).toHaveBeenCalledWith('/api/folios/folio-1/download'));
  });

  it('makes no certification or submission claim in its copy (**AT-136**)', async () => {
    const { container } = renderSection('owner');
    await screen.findByText('v2');
    const copy = container.textContent ?? '';
    for (const claim of [
      /certified/i,
      /compliant/i,
      /approved/i,
      /submitted to/i,
      /lodge/i,
      /accepted by/i,
    ]) {
      expect(copy).not.toMatch(claim);
    }
    // And says the true thing out loud.
    expect(copy).toMatch(/not a certification/i);
  });
});

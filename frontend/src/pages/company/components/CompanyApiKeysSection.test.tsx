import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api';
import { CompanyApiKeysSection } from './CompanyApiKeysSection';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});

const apiFetchMock = vi.mocked(apiFetch);

const inventory = {
  apiKeys: [
    {
      id: 'key-own',
      name: 'My key',
      keyPrefix: 'sp_own1234',
      scopes: 'read',
      lastUsedAt: null,
      expiresAt: null,
      isActive: true,
      createdAt: '2026-06-01T00:00:00.000Z',
      owner: { id: 'me', fullName: 'Me User', email: 'me@x.test' },
    },
    {
      id: 'key-other',
      name: 'Their key',
      keyPrefix: 'sp_oth1234',
      scopes: 'write',
      lastUsedAt: '2026-06-20T00:00:00.000Z',
      expiresAt: null,
      isActive: true,
      createdAt: '2026-06-02T00:00:00.000Z',
      owner: { id: 'them', fullName: 'Them User', email: 'them@x.test' },
    },
  ],
  count: 2,
};

beforeEach(() => {
  apiFetchMock.mockReset();
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});

describe('CompanyApiKeysSection', () => {
  it('lists keys and offers revoke only on the current user’s active key', async () => {
    apiFetchMock.mockResolvedValueOnce(inventory);

    render(<CompanyApiKeysSection currentUserId="me" />);

    await screen.findByText('My key');
    expect(screen.getByText('Their key')).toBeInTheDocument();
    expect(screen.getByText('Me User')).toBeInTheDocument();
    expect(screen.getByText('Them User')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Revoke/ })).toHaveLength(1);
    expect(apiFetchMock).toHaveBeenCalledWith('/api/company/api-keys');
  });

  it('creates a key and reveals the secret once with a copy action', async () => {
    apiFetchMock.mockResolvedValueOnce(inventory);
    apiFetchMock.mockResolvedValueOnce({
      apiKey: {
        id: 'key-new',
        name: 'New',
        keyPrefix: 'sp_new12345',
        scopes: 'read',
        expiresAt: null,
        createdAt: '2026-06-21T00:00:00.000Z',
        key: 'sp_thefullsecret',
      },
      message: 'created',
    });
    apiFetchMock.mockResolvedValueOnce(inventory);

    render(<CompanyApiKeysSection currentUserId="me" />);
    await screen.findByText('My key');

    fireEvent.click(screen.getByRole('button', { name: /Create API key/ }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create key' }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: 'New', scopes: 'read' }),
      });
    });

    expect(await screen.findByText('sp_thefullsecret')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Copy to clipboard' }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('sp_thefullsecret');
    });
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('revokes the current user’s key', async () => {
    apiFetchMock.mockResolvedValueOnce(inventory);
    apiFetchMock.mockResolvedValueOnce({ message: 'revoked' });

    render(<CompanyApiKeysSection currentUserId="me" />);
    await screen.findByText('My key');

    fireEvent.click(screen.getByRole('button', { name: /Revoke/ }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/api-keys/key-own', { method: 'DELETE' });
    });
  });
});

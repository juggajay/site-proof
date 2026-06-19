import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase.js', async () => {
  const actual =
    await vi.importActual<typeof import('../../lib/supabase.js')>('../../lib/supabase.js');
  return {
    ...actual,
    isSupabaseConfigured: vi.fn(() => true),
  };
});

import {
  buildGoogleOAuthLoginResponse,
  buildMockOAuthLoginResponse,
  buildOAuthExchangeResponse,
} from './responses.js';

describe('OAuth response helpers', () => {
  it('preserves Google identity login response shape including avatar', () => {
    expect(
      buildGoogleOAuthLoginResponse(
        {
          id: 'user-1',
          email: 'owner@example.com',
          fullName: 'Owner One',
          role: 'owner',
          companyId: 'company-1',
          companyName: 'SiteProof Civil',
          avatarUrl: 'https://example.com/avatar.png',
        },
        'jwt-token',
      ),
    ).toEqual({
      user: {
        id: 'user-1',
        email: 'owner@example.com',
        fullName: 'Owner One',
        role: 'owner',
        companyId: 'company-1',
        companyName: 'SiteProof Civil',
        avatarUrl: 'https://example.com/avatar.png',
      },
      token: 'jwt-token',
    });
  });

  it('preserves OAuth callback exchange response shape and provider', () => {
    expect(
      buildOAuthExchangeResponse(
        {
          id: 'user-1',
          email: 'owner@example.com',
          fullName: 'Owner One',
          roleInCompany: 'admin',
          companyId: 'company-1',
          company: { name: 'SiteProof Civil' },
          avatarUrl: null,
        },
        'jwt-token',
        'google',
      ),
    ).toEqual({
      user: {
        id: 'user-1',
        email: 'owner@example.com',
        fullName: 'Owner One',
        role: 'admin',
        companyId: 'company-1',
        companyName: 'SiteProof Civil',
        avatarUrl: null,
      },
      token: 'jwt-token',
      provider: 'google',
    });
  });

  it('serializes existing Supabase avatars as signed backend URLs', () => {
    const response = buildGoogleOAuthLoginResponse(
      {
        id: 'user-1',
        email: 'owner@example.com',
        fullName: 'Owner One',
        role: 'owner',
        companyId: 'company-1',
        companyName: 'SiteProof Civil',
        avatarUrl: 'supabase://documents/avatars/user-1/avatar-user-1.png',
      },
      'jwt-token',
    );

    expect(response.user.avatarUrl).toContain('/api/auth/avatar/file/user-1?token=');
    expect(response.user.avatarUrl).not.toContain('supabase://');
    expect(response.user.avatarUrl).not.toContain('/storage/v1/object/public/');
  });

  it('preserves null company name in callback exchange response', () => {
    expect(
      buildOAuthExchangeResponse(
        {
          id: 'user-1',
          email: 'owner@example.com',
          fullName: null,
          roleInCompany: 'member',
          companyId: null,
          company: null,
          avatarUrl: null,
        },
        'jwt-token',
        'google',
      ).user.companyName,
    ).toBeNull();
  });

  it('preserves mock OAuth response shape without avatar field', () => {
    expect(
      buildMockOAuthLoginResponse(
        {
          id: 'user-1',
          email: 'owner@example.com',
          fullName: 'Owner One',
          role: 'owner',
          companyId: 'company-1',
          companyName: 'SiteProof Civil',
          avatarUrl: 'https://example.com/avatar.png',
        },
        'jwt-token',
      ),
    ).toEqual({
      user: {
        id: 'user-1',
        email: 'owner@example.com',
        fullName: 'Owner One',
        role: 'owner',
        companyId: 'company-1',
        companyName: 'SiteProof Civil',
      },
      token: 'jwt-token',
    });
  });
});

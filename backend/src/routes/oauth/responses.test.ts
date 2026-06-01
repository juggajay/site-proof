import { describe, expect, it } from 'vitest';

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

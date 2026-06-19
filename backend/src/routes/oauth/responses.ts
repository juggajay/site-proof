import { buildAvatarDisplayUrl } from '../../lib/avatarUrls.js';

type OAuthUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  companyId: string | null;
  companyName: string | null;
  avatarUrl?: string | null;
};

type OAuthExchangeUser = {
  id: string;
  email: string;
  fullName: string | null;
  roleInCompany: string;
  companyId: string | null;
  avatarUrl: string | null;
  company?: { name: string } | null;
};

export function buildGoogleOAuthLoginResponse(user: OAuthUser, token: string) {
  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      companyId: user.companyId,
      companyName: user.companyName,
      avatarUrl: buildAvatarDisplayUrl(user.id, user.avatarUrl),
    },
    token,
  };
}

export function buildOAuthExchangeResponse(
  user: OAuthExchangeUser,
  token: string,
  provider: string,
) {
  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.roleInCompany,
      companyId: user.companyId,
      companyName: user.company?.name || null,
      avatarUrl: buildAvatarDisplayUrl(user.id, user.avatarUrl),
    },
    token,
    provider,
  };
}

export function buildMockOAuthLoginResponse(user: OAuthUser, token: string) {
  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      companyId: user.companyId,
      companyName: user.companyName,
    },
    token,
  };
}

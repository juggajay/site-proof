/**
 * Data + pure helpers for the company API-keys section (finding H22).
 *
 * The company-wide inventory comes from the admin endpoint
 * GET /api/company/api-keys (M72b). Create still uses the per-user endpoint
 * because the raw key belongs to the current user, while company inventory
 * revoke uses DELETE /api/company/api-keys/:keyId so company admins can retire
 * active same-company keys owned by any member.
 */
import { apiFetch } from '@/lib/api';

export interface CompanyApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  owner: { id: string; fullName: string | null; email: string } | null;
}

export interface CompanyApiKeyInventoryResponse {
  apiKeys: CompanyApiKey[];
  count: number;
}

/** The create response includes the raw key exactly once — never stored client-side. */
export interface CreatedApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string;
  expiresAt: string | null;
  createdAt: string;
  key: string;
}

export interface CreateApiKeyResponse {
  apiKey: CreatedApiKey;
  message: string;
}

export const API_KEY_SCOPE_OPTIONS = [
  { value: 'read', label: 'Read only' },
  { value: 'write', label: 'Read & write' },
] as const;

export function canRevokeApiKey(
  key: Pick<CompanyApiKey, 'isActive' | 'owner'>,
  _currentUserId: string | null | undefined,
): boolean {
  return key.isActive;
}

export function describeApiKeyStatus(key: Pick<CompanyApiKey, 'isActive'>): 'Active' | 'Revoked' {
  return key.isActive ? 'Active' : 'Revoked';
}

export function formatApiKeyLastUsed(lastUsedAt: string | null): string {
  if (!lastUsedAt) {
    return 'Never used';
  }
  return new Date(lastUsedAt).toLocaleDateString('en-AU');
}

export function fetchCompanyApiKeys() {
  return apiFetch<CompanyApiKeyInventoryResponse>('/api/company/api-keys');
}

export function createApiKey(body: { name: string; scopes?: string; expiresInDays?: number }) {
  return apiFetch<CreateApiKeyResponse>('/api/api-keys', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function revokeApiKey(id: string) {
  return apiFetch<{ message: string }>(`/api/company/api-keys/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

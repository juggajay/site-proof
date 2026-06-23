/**
 * Data + pure helpers for the company API-keys section (finding H22).
 *
 * The company-wide inventory comes from the admin endpoint
 * GET /api/company/api-keys (M72b). Create/revoke act on the per-user endpoints
 * (POST/DELETE /api/api-keys) — a user can only create and revoke their own
 * keys, so revoke is offered only on the current user's rows; departed members'
 * keys are revoked automatically (M72a).
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

/**
 * A user may only revoke their own active keys (the backend DELETE endpoint is
 * self-scoped). Inventory rows for other members are visibility-only.
 */
export function canRevokeApiKey(
  key: Pick<CompanyApiKey, 'isActive' | 'owner'>,
  currentUserId: string | null | undefined,
): boolean {
  return key.isActive && !!currentUserId && key.owner?.id === currentUserId;
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
  return apiFetch<{ message: string }>(`/api/api-keys/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

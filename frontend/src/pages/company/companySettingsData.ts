import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { extractErrorMessage, isNotFound } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';

// ---------------------------------------------------------------------------
// Types — the company profile data contract used by CompanySettingsPage.
// ---------------------------------------------------------------------------

export interface Company {
  id: string;
  name: string;
  abn: string | null;
  address: string | null;
  logoUrl: string | null;
  subscriptionTier: string;
  projectCount: number;
  projectLimit: number | null;
  userCount: number;
  userLimit: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Editable buffer shape seeded from a loaded company. */
export interface CompanyFormData {
  name: string;
  abn: string;
  address: string;
  logoUrl: string;
}

interface CompanyResponse {
  company: Company;
}

// ---------------------------------------------------------------------------
// Path builders
// ---------------------------------------------------------------------------

export function buildCompanyPath(): string {
  return '/api/company';
}

// ---------------------------------------------------------------------------
// Response normalization
// ---------------------------------------------------------------------------

export function normalizeCompanyResponse(data: CompanyResponse): Company {
  return data.company;
}

/** Map a loaded company into the editable form buffer. */
export function toCompanyFormData(company: Company): CompanyFormData {
  return {
    name: company.name || '',
    abn: company.abn || '',
    address: company.address || '',
    logoUrl: company.logoUrl || '',
  };
}

// ---------------------------------------------------------------------------
// Plan / limit presentation helpers (pure, derived from the company record).
// ---------------------------------------------------------------------------

export function formatLimit(limit: number | null | undefined, fallback: number): string {
  if (limit === null) return 'Unlimited';
  return (limit ?? fallback).toString();
}

export function hasFiniteLimit(limit: number | null | undefined): limit is number {
  return typeof limit === 'number' && Number.isFinite(limit);
}

export function getPlanBillingLabel(subscriptionTier: string | null | undefined): string {
  switch ((subscriptionTier || 'basic').toLowerCase()) {
    case 'professional':
      return '$99/month';
    case 'enterprise':
    case 'unlimited':
      return 'Custom pricing';
    default:
      return 'Contact billing';
  }
}

export function getPlanStorageLabel(subscriptionTier: string | null | undefined): string {
  switch ((subscriptionTier || 'basic').toLowerCase()) {
    case 'professional':
      return '100 GB';
    case 'enterprise':
    case 'unlimited':
      return 'Unlimited';
    default:
      return '1 GB';
  }
}

// ---------------------------------------------------------------------------
// Load-error mapping — preserves the page's 404-vs-generic messaging.
// ---------------------------------------------------------------------------

export function getCompanyLoadErrorMessage(error: unknown): string {
  if (isNotFound(error)) {
    return 'No company associated with your account';
  }
  return extractErrorMessage(error, 'Failed to load company settings');
}

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

async function fetchCompany(): Promise<Company> {
  try {
    const data = await apiFetch<CompanyResponse>(buildCompanyPath());
    return normalizeCompanyResponse(data);
  } catch (error) {
    logError('Failed to fetch company:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Query hook
// ---------------------------------------------------------------------------

/**
 * Page bootstrap: the authenticated user's company profile.
 *
 * Behavior preserved from the previous hand-rolled fetch:
 *  - `retry: false` — the original made a single attempt. The global
 *    QueryClient default is `retry: 1`, which would silently re-attempt a
 *    first-load failure and change the error/"Try again" surface (the
 *    `company-settings.spec.ts` recovery test asserts the single-attempt
 *    load count and the spinner-during-retry behavior).
 *  - No `enabled` guard — the original fetched unconditionally on mount; the
 *    page is already behind authenticated routing.
 */
export function useCompanySettingsQuery() {
  return useQuery({
    queryKey: queryKeys.companySettings,
    queryFn: fetchCompany,
    retry: false,
  });
}

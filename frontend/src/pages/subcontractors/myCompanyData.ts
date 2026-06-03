import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { logError } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';

// ===== Data contract =====
// Response shape for the "My Company" bootstrap read. Mirrors the full object
// returned by GET /api/subcontractors/my-company, including the fields the page
// renders that the narrower portal `Company` view (docketEditData.ts) omits:
// companyName, abn, primary contact details, status, and availableProjects.

export interface Employee {
  id: string;
  name: string;
  phone: string;
  role: string;
  hourlyRate: number;
  status: 'pending' | 'approved' | 'inactive';
}

export interface Plant {
  id: string;
  type: string;
  description: string;
  idRego: string;
  dryRate: number;
  wetRate: number;
  status: 'pending' | 'approved' | 'inactive';
}

export interface CompanyData {
  id: string;
  companyName: string;
  abn: string;
  projectId: string;
  projectName: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  status: string;
  availableProjects?: Array<{
    projectId: string;
    projectName: string;
    companyName: string;
    status: string;
  }>;
  employees: Employee[];
  plant: Plant[];
}

export interface MyCompanyResponse {
  company?: CompanyData | null;
}

// ===== Path builder =====
// Byte-identical to the original inline fetch: the requested project id is
// URL-encoded into the query string, and an absent project id yields no query.

export function buildMyCompanyPath(requestedProjectId: string | null | undefined): string {
  const query = requestedProjectId ? `?projectId=${encodeURIComponent(requestedProjectId)}` : '';
  return `/api/subcontractors/my-company${query}`;
}

// ===== Normalizer =====
// The original set companyData directly from response.company, so a missing or
// null company resolves to null (rendered as the "No Company Found" empty state)
// rather than being treated as a load error.

export function normalizeMyCompanyResponse(data: MyCompanyResponse): CompanyData | null {
  return data.company ?? null;
}

// ===== Fetcher =====

async function fetchMyCompany(
  requestedProjectId: string | null | undefined,
): Promise<CompanyData | null> {
  try {
    const data = await apiFetch<MyCompanyResponse>(buildMyCompanyPath(requestedProjectId));
    return normalizeMyCompanyResponse(data);
  } catch (error) {
    logError('Error fetching company data:', error);
    throw error;
  }
}

// ===== Query hook =====
// Scoped by user id so one subcontractor's cached company never leaks to another
// account in the same browser session (mirrors the portal-read convention,
// commit 9574ced). retry: false preserves the original single-attempt fetch that
// surfaced the load-error card immediately on failure.

export function useMyCompanyQuery(
  userId: string | null | undefined,
  requestedProjectId: string | null | undefined,
) {
  return useQuery({
    queryKey: queryKeys.myCompany(userId, requestedProjectId),
    queryFn: () => fetchMyCompany(requestedProjectId),
    enabled: Boolean(userId),
    retry: false,
  });
}

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { CsvBrandingContext } from '@/lib/csv';

type BrandingResponse = {
  company?: { name?: string | null; abn?: string | null } | null;
  projectName?: string | null;
};

// Provenance context for branded CSV exports, from the same `/branding` endpoint
// the PDF layer uses (company name + ABN + project name). Endpoint-only so it can
// be called from any component without an AuthProvider; project-less exports pass
// null and let the branding fall back to a plain CIVOS preamble. Best-effort —
// a failed fetch still yields a consistent preamble.
export function useCsvBranding(projectId?: string | null): CsvBrandingContext {
  const { data } = useQuery({
    queryKey: ['csv-branding', projectId],
    queryFn: () =>
      apiFetch<BrandingResponse>(`/api/projects/${encodeURIComponent(projectId ?? '')}/branding`),
    enabled: Boolean(projectId),
    staleTime: 5 * 60 * 1000,
  });

  return {
    companyName: data?.company?.name ?? null,
    abn: data?.company?.abn ?? null,
    projectName: data?.projectName ?? null,
  };
}

/**
 * subbieShellData.ts — shared data layer for the /p/* subbie shell sub-tree.
 *
 * NEW PRESENTATION over EXISTING LOGIC. Reuses the SAME TanStack queries the
 * classic portal pages use so the cache is shared (no double-fetch when a subbie
 * bounces between the shell and a classic page):
 *   - my-company bootstrap → `queryKeys.portalCompanies(userId) + projectId`
 *     (exactly the key SubcontractorDashboard uses).
 *   - module gating → `isPortalModuleEnabled` from portalAccessModel (imported,
 *     never duplicated).
 *
 * The bootstrap drives everything: company, portalAccess, the multi-project
 * switcher (`availableProjects`), and the selected projectId (?projectId= search
 * param, else the first available project). The Home screen layers the dockets /
 * lots / notifications queries on top with the existing portal query keys.
 *
 * No new endpoints; no new packages.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/lib/auth';
import { extractErrorMessage } from '@/lib/errorHandling';
import {
  buildPortalCompanyQuery,
  portalCompanyQueryKeyParts,
} from '@/pages/subcontractor-portal/portalCompanyScope';
import {
  isPortalModuleEnabled,
  type PortalAccess,
} from '@/pages/subcontractor-portal/portalAccessModel';

export interface SubbiePortalProjectOption {
  id: string;
  subcontractorCompanyId?: string;
  companyName: string;
  projectId: string;
  projectName: string;
  status: string;
  portalAccess?: Partial<PortalAccess>;
}

export interface SubbieCompany {
  id: string;
  companyName: string;
  abn?: string;
  projectId: string;
  projectName: string;
  availableProjects?: SubbiePortalProjectOption[];
  employees: Array<{ id: string; name: string; status: string }>;
  plant: Array<{ id: string; type: string; status: string }>;
  portalAccess?: Partial<PortalAccess>;
}

export interface SubbieShellData {
  /** The selected project id (search param, else first available). null until loaded. */
  projectId: string | null;
  subcontractorCompanyId?: string | null;
  company: SubbieCompany | null;
  companyName: string | null;
  projectName: string | null;
  availableProjects: SubbiePortalProjectOption[];
  loading: boolean;
  loadError: string | null;
  /** Module gate — delegates to the shared isPortalModuleEnabled. */
  isModuleEnabled: (module: keyof PortalAccess) => boolean;
}

export function useSubbieShellData(): SubbieShellData {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedProjectId = searchParams.get('projectId');
  const requestedSubcontractorCompanyId = searchParams.get('subcontractorCompanyId');

  const companyQuery = useQuery({
    // Same key shape as SubcontractorDashboard so the cache is shared.
    queryKey: [
      ...queryKeys.portalCompanies(user?.id),
      ...portalCompanyQueryKeyParts({
        projectId: requestedProjectId,
        subcontractorCompanyId: requestedSubcontractorCompanyId,
      }),
    ],
    queryFn: async () => {
      const query = buildPortalCompanyQuery({
        projectId: requestedProjectId,
        subcontractorCompanyId: requestedSubcontractorCompanyId,
      });
      const res = await apiFetch<{ company: SubbieCompany }>(
        `/api/subcontractors/my-company${query}`,
      );
      return res.company;
    },
    enabled: !!user?.id,
  });

  const company = companyQuery.data ?? null;
  const availableProjects = company?.availableProjects ?? [];
  const hasCompleteRequestedScope = !!requestedProjectId && !!requestedSubcontractorCompanyId;
  const hasResolvedCompanyScope = hasCompleteRequestedScope || !!company;

  // Selected project: ?projectId= wins, else the server-resolved company's
  // projectId (the backend defaults to the first available project when no
  // projectId is passed), else the first available option.
  const projectId = hasResolvedCompanyScope
    ? (requestedProjectId ?? company?.projectId ?? availableProjects[0]?.projectId ?? null)
    : null;
  const subcontractorCompanyId = hasResolvedCompanyScope
    ? (requestedSubcontractorCompanyId ?? company?.id ?? availableProjects[0]?.id ?? null)
    : null;

  const loading = companyQuery.isLoading && !companyQuery.data;
  const loadError =
    companyQuery.error && !companyQuery.data
      ? extractErrorMessage(companyQuery.error, 'Failed to load your company')
      : null;

  const isModuleEnabled = useMemo(
    () => (module: keyof PortalAccess) => isPortalModuleEnabled(company, module),
    [company],
  );

  return {
    projectId,
    subcontractorCompanyId,
    company,
    companyName: company?.companyName ?? null,
    projectName: company?.projectName ?? null,
    availableProjects,
    loading,
    loadError,
    isModuleEnabled,
  };
}

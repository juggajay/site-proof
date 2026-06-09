import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { logError } from '@/lib/logger';

export interface ResponsibleUserOption {
  userId: string;
  label: string;
}

export interface ResponsibleSubcontractorOption {
  id: string;
  label: string;
}

interface ProjectUsersResponse {
  users: Array<{
    userId: string;
    email: string;
    fullName: string | null;
    status: string;
  }>;
}

interface SubcontractorsForProjectResponse {
  subcontractors: Array<{
    id: string;
    companyName: string;
    status: string;
  }>;
}

const BLOCKED_SUBCONTRACTOR_STATUSES = new Set(['suspended', 'removed']);

interface UseResponsiblePartyOptionsResult {
  users: ResponsibleUserOption[];
  subcontractors: ResponsibleSubcontractorOption[];
  /**
   * True when the subcontractor list could not be loaded (e.g. the current
   * role lacks subcontractor-management access and the project-subcontractors
   * endpoint returns 403). The picker still works — People + Unassigned are
   * available — but no subcontractors can be shown. Lets the UI surface a small
   * explanatory note instead of silently hiding the option group.
   */
  subcontractorsUnavailable: boolean;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/**
 * Loads the option lists for the NCR "responsible party" picker: active project
 * users (value = userId, matches responsibleUserId) and active subcontractor
 * companies (value = id, matches responsibleSubcontractorId). Sourced from the
 * existing project-users and project-subcontractors endpoints. Only fetches
 * while `enabled` (e.g. the modal is open).
 *
 * The two fetches are settled independently. Every role allowed to create/assign
 * NCRs (NCR_CREATE_ROLES) can read project users, but the subcontractor list
 * endpoint requires subcontractor-management access — so quality_manager,
 * site_engineer and foreman get a 403 there. We MUST NOT let that collapse the
 * whole picker: People always load, and a subcontractor 403 degrades gracefully
 * (empty subcontractor list + `subcontractorsUnavailable` note). `error` is set
 * only when the People fetch itself fails, since that is a real picker failure.
 */
export function useResponsiblePartyOptions(
  projectId: string | undefined,
  enabled: boolean,
): UseResponsiblePartyOptionsResult {
  const [users, setUsers] = useState<ResponsibleUserOption[]>([]);
  const [subcontractors, setSubcontractors] = useState<ResponsibleSubcontractorOption[]>([]);
  const [subcontractorsUnavailable, setSubcontractorsUnavailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (!projectId) {
      setUsers([]);
      setSubcontractors([]);
      setSubcontractorsUnavailable(false);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      setSubcontractorsUnavailable(false);

      const [usersResult, subsResult] = await Promise.allSettled([
        apiFetch<ProjectUsersResponse>(`/api/projects/${encodeURIComponent(projectId)}/users`),
        apiFetch<SubcontractorsForProjectResponse>(
          `/api/subcontractors/project/${encodeURIComponent(projectId)}`,
        ),
      ]);

      if (cancelled) return;

      // People: failure here IS a real picker error (every NCR_CREATE_ROLE can
      // read project users, so a rejection means something genuinely broke).
      if (usersResult.status === 'fulfilled') {
        setUsers(
          (usersResult.value.users || [])
            .filter((projectUser) => projectUser.status === 'active')
            .map((projectUser) => ({
              userId: projectUser.userId,
              label: projectUser.fullName || projectUser.email,
            })),
        );
      } else {
        logError('Failed to load assignable people:', usersResult.reason);
        setUsers([]);
        setError('Failed to load assignable people.');
      }

      // Subcontractors: failure is EXPECTED for roles without subcontractor-
      // management access (quality_manager, site_engineer, foreman get a 403).
      // Degrade gracefully — keep the picker usable with People + Unassigned and
      // flag that the subcontractor list was omitted. Do NOT set `error`.
      if (subsResult.status === 'fulfilled') {
        setSubcontractors(
          (subsResult.value.subcontractors || [])
            .filter((sub) => !BLOCKED_SUBCONTRACTOR_STATUSES.has(sub.status))
            .map((sub) => ({ id: sub.id, label: sub.companyName })),
        );
      } else {
        logError('Subcontractor list unavailable for responsible-party picker:', subsResult.reason);
        setSubcontractors([]);
        setSubcontractorsUnavailable(true);
      }

      setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [projectId, enabled, retryKey]);

  return {
    users,
    subcontractors,
    subcontractorsUnavailable,
    loading,
    error,
    retry: () => setRetryKey((key) => key + 1),
  };
}

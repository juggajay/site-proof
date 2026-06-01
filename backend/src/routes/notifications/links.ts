import type { SubcontractorPortalAccessKey } from '../../lib/projectAccess.js';
import { appendQueryParams } from './validation.js';

/**
 * Notification deep-link / portal-target helpers, extracted verbatim from
 * backend/src/routes/notifications.ts as a slice of the notifications route
 * split (engineering-health Workstream 1).
 *
 * Both helpers are pure and synchronous — no Express, Prisma, or DB access. They
 * map an entity type (and id/project) to the in-app URL a notification links to,
 * and (for subcontractor recipients) to the portal module that gates whether the
 * alert is visible. Entity-type normalization (lower-casing, collapsing spaces
 * and hyphens to underscores), the exact URL paths, id encoding, and the
 * fallback/null behaviour are preserved exactly as they were inline in the route
 * file.
 */

type SubcontractorAlertPortalTarget = SubcontractorPortalAccessKey | 'dockets';

export function getSubcontractorAlertPortalTarget(
  entityType: string,
): SubcontractorAlertPortalTarget | null {
  const normalizedType = entityType.toLowerCase().replace(/[\s-]/g, '_');

  switch (normalizedType) {
    case 'lot':
      return 'lots';
    case 'itp':
    case 'itp_instance':
    case 'itpinstance':
    case 'itp_completion':
    case 'itpcompletion':
      return 'itps';
    case 'holdpoint':
    case 'hold_point':
      return 'holdPoints';
    case 'test':
    case 'test_result':
    case 'testresult':
      return 'testResults';
    case 'ncr':
      return 'ncrs';
    case 'document':
      return 'documents';
    case 'docket':
    case 'daily_docket':
    case 'dailydocket':
      return 'dockets';
    default:
      return null;
  }
}

export function buildProjectEntityLink(
  entityType: string,
  entityId: string,
  projectId?: string | null,
  params?: Record<string, string | undefined>,
): string {
  if (!projectId) {
    return '/dashboard';
  }

  const encodedProjectId = encodeURIComponent(projectId);
  const encodedEntityId = encodeURIComponent(entityId);
  const normalizedType = entityType.toLowerCase().replace(/[\s-]/g, '_');

  switch (normalizedType) {
    case 'lot':
      return appendQueryParams(`/projects/${encodedProjectId}/lots/${encodedEntityId}`, params);
    case 'ncr':
      return appendQueryParams(`/projects/${encodedProjectId}/ncr`, { ncr: entityId, ...params });
    case 'test':
    case 'test_result':
    case 'testresult':
      return appendQueryParams(`/projects/${encodedProjectId}/tests`, {
        test: entityId,
        ...params,
      });
    case 'holdpoint':
    case 'hold_point':
      return appendQueryParams(`/projects/${encodedProjectId}/hold-points`, {
        holdPoint: entityId,
        ...params,
      });
    case 'document':
      return appendQueryParams(`/projects/${encodedProjectId}/documents`, {
        document: entityId,
        ...params,
      });
    case 'drawing':
      return appendQueryParams(`/projects/${encodedProjectId}/drawings`, {
        drawing: entityId,
        ...params,
      });
    case 'docket':
    case 'daily_docket':
    case 'dailydocket':
      return appendQueryParams(`/projects/${encodedProjectId}/dockets`, {
        docket: entityId,
        ...params,
      });
    case 'diary':
    case 'daily_diary':
    case 'dailydiary':
      return appendQueryParams(`/projects/${encodedProjectId}/diary`, params);
    case 'progress_claim':
    case 'progressclaim':
    case 'claim':
      return appendQueryParams(`/projects/${encodedProjectId}/claims`, {
        claim: entityId,
        ...params,
      });
    case 'itp':
    case 'itp_instance':
    case 'itpinstance':
      return appendQueryParams(`/projects/${encodedProjectId}/itp`, { itp: entityId, ...params });
    default:
      return appendQueryParams(`/projects/${encodedProjectId}`, params);
  }
}

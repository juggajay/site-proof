import { apiFetch } from '../api';
import type { ConformanceCoverage } from './types';

/**
 * Project chainage coverage for the conformance pack's coverage section.
 * Best-effort — a coverage failure (or a project with no control lines) must
 * never fail report generation, so errors resolve to null and the section
 * renders a one-line note instead. Mirrors fetchPdfBranding's pattern.
 */
export async function fetchConformanceCoverage(
  projectId: string,
): Promise<ConformanceCoverage | null> {
  try {
    return await apiFetch<ConformanceCoverage>(
      `/api/projects/${encodeURIComponent(projectId)}/coverage`,
    );
  } catch {
    return null;
  }
}

import { apiFetch } from '../api';
import type { PDFCompanyBranding } from './types';

type ProjectBrandingResponse = { company: PDFCompanyBranding | null };

/**
 * Company block for generated documents: name, ABN, address, and a logo the
 * backend embeds as a data URL (no live logo fetch during PDF generation).
 * Best-effort — an unbranded PDF beats a failed download, so errors resolve
 * to null rather than throwing.
 */
export async function fetchPdfBranding(projectId: string): Promise<PDFCompanyBranding | null> {
  try {
    const data = await apiFetch<ProjectBrandingResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/branding`,
    );
    return data.company ?? null;
  } catch {
    return null;
  }
}

import { withProvenanceVisibility } from '../../lib/itpProvenance.js';

export function buildEmptyCrossProjectTemplatesResponse() {
  return { projects: [], templates: [] };
}

export function buildCrossProjectTemplatesResponse(projects: unknown[], totalTemplates: number) {
  return {
    projects,
    totalTemplates,
  };
}

// Wave G G2 (spec §2.4): every template surface already routes through these
// two builders, so the flag-off projection lives here and nowhere else.
export function buildTemplateListResponse(
  templates: unknown[],
  projectSpecificationSet: string | null,
) {
  return {
    templates: templates.map(withProvenanceVisibility),
    projectSpecificationSet,
  };
}

export function buildTemplateResponse(template: unknown) {
  return { template: withProvenanceVisibility(template) };
}

export function buildTemplateUsageResponse(lots: unknown[]) {
  return {
    lots,
    total: lots.length,
  };
}

export function buildTemplateDeletedResponse() {
  return {
    success: true,
    message: 'Template deleted successfully',
  };
}

export function buildTemplateArchivedResponse(template: unknown) {
  return {
    success: true,
    message:
      'Template archived. It will no longer appear in template selection but existing lots will continue working.',
    template,
  };
}

export function buildTemplateRestoredResponse(template: unknown) {
  return {
    success: true,
    message: 'Template restored and is now active.',
    template,
  };
}

export function buildTemplatePropagatedResponse(updatedCount: number) {
  return {
    success: true,
    updatedCount,
    message: `Updated ${updatedCount} lot(s) with latest template`,
  };
}

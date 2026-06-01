import { describe, expect, it } from 'vitest';
import {
  buildCrossProjectTemplatesResponse,
  buildEmptyCrossProjectTemplatesResponse,
  buildTemplateArchivedResponse,
  buildTemplateDeletedResponse,
  buildTemplateListResponse,
  buildTemplatePropagatedResponse,
  buildTemplateResponse,
  buildTemplateRestoredResponse,
  buildTemplateUsageResponse,
} from './templateResponses.js';

describe('templateResponses', () => {
  it('builds the empty cross-project import response', () => {
    expect(buildEmptyCrossProjectTemplatesResponse()).toEqual({
      projects: [],
      templates: [],
    });
  });

  it('builds the populated cross-project import response', () => {
    const projects = [{ id: 'project-1', templates: [{ id: 'template-1' }] }];

    expect(buildCrossProjectTemplatesResponse(projects, 3)).toEqual({
      projects,
      totalTemplates: 3,
    });
  });

  it('builds the project template list response', () => {
    const templates = [{ id: 'template-1', name: 'Earthworks' }];

    expect(buildTemplateListResponse(templates, 'TfNSW')).toEqual({
      templates,
      projectSpecificationSet: 'TfNSW',
    });
  });

  it('builds the shared template envelope', () => {
    const template = { id: 'template-1' };

    expect(buildTemplateResponse(template)).toEqual({ template });
  });

  it('builds the usage response with a derived total', () => {
    const lots = [{ id: 'lot-1' }, { id: 'lot-2' }];

    expect(buildTemplateUsageResponse(lots)).toEqual({
      lots,
      total: 2,
    });
  });

  it('builds the delete success response', () => {
    expect(buildTemplateDeletedResponse()).toEqual({
      success: true,
      message: 'Template deleted successfully',
    });
  });

  it('builds archive and restore responses with the existing copy', () => {
    const template = { id: 'template-1', isActive: false };

    expect(buildTemplateArchivedResponse(template)).toEqual({
      success: true,
      message:
        'Template archived. It will no longer appear in template selection but existing lots will continue working.',
      template,
    });
    expect(buildTemplateRestoredResponse(template)).toEqual({
      success: true,
      message: 'Template restored and is now active.',
      template,
    });
  });

  it('builds the propagate response with the count in the message', () => {
    expect(buildTemplatePropagatedResponse(4)).toEqual({
      success: true,
      updatedCount: 4,
      message: 'Updated 4 lot(s) with latest template',
    });
  });
});

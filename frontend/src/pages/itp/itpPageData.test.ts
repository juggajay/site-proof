import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import {
  applyItpTemplatesUpdate,
  buildCrossProjectTemplatesPath,
  buildItpTemplatesPath,
  normalizeCrossProjectTemplates,
  normalizeItpTemplatesResponse,
  type ITPTemplate,
  type ItpTemplatesData,
} from './itpPageData';

const baseTemplate: ITPTemplate = {
  id: 'tpl-1',
  name: 'Earthworks ITP',
  description: 'Seeded template',
  activityType: 'Earthworks',
  createdAt: '2026-01-15T00:00:00.000Z',
  isGlobalTemplate: false,
  stateSpec: null,
  isActive: true,
  checklistItems: [],
};

describe('itp page data helpers', () => {
  describe('buildItpTemplatesPath', () => {
    it('includes the projectId and includeGlobal flag', () => {
      expect(buildItpTemplatesPath('proj-1', true)).toBe(
        '/api/itp/templates?projectId=proj-1&includeGlobal=true',
      );
    });

    it('serializes includeGlobal=false when library templates are excluded', () => {
      expect(buildItpTemplatesPath('proj-1', false)).toBe(
        '/api/itp/templates?projectId=proj-1&includeGlobal=false',
      );
    });

    it('encodes project ids that contain reserved characters', () => {
      expect(buildItpTemplatesPath('proj 1', true)).toBe(
        '/api/itp/templates?projectId=proj+1&includeGlobal=true',
      );
    });
  });

  describe('buildCrossProjectTemplatesPath', () => {
    it('scopes the request to the current project', () => {
      expect(buildCrossProjectTemplatesPath('proj-1')).toBe(
        '/api/itp/templates/cross-project?currentProjectId=proj-1',
      );
    });
  });

  describe('normalizeItpTemplatesResponse', () => {
    it('passes templates and spec set through when present', () => {
      expect(
        normalizeItpTemplatesResponse({
          templates: [baseTemplate],
          projectSpecificationSet: 'TfNSW',
        }),
      ).toEqual({ templates: [baseTemplate], projectSpecificationSet: 'TfNSW' });
    });

    it('defaults missing templates to an empty list', () => {
      expect(normalizeItpTemplatesResponse({})).toEqual({
        templates: [],
        projectSpecificationSet: null,
      });
    });

    it('coerces an empty spec set to null', () => {
      expect(
        normalizeItpTemplatesResponse({ templates: [baseTemplate], projectSpecificationSet: '' }),
      ).toEqual({ templates: [baseTemplate], projectSpecificationSet: null });
    });
  });

  describe('normalizeCrossProjectTemplates', () => {
    it('returns the projects array when present', () => {
      const projects = [{ id: 'p1', name: 'Source', code: 'SRC', templates: [] }];
      expect(normalizeCrossProjectTemplates({ projects })).toEqual(projects);
    });

    it('treats a missing projects field as empty', () => {
      expect(normalizeCrossProjectTemplates({})).toEqual([]);
    });
  });

  describe('applyItpTemplatesUpdate', () => {
    it('updates the templates of the active query while preserving the spec set', () => {
      const queryClient = new QueryClient();
      const key = queryKeys.itpTemplates('proj-1', true);
      queryClient.setQueryData<ItpTemplatesData>(key, {
        templates: [baseTemplate],
        projectSpecificationSet: 'TfNSW',
      });

      const added: ITPTemplate = { ...baseTemplate, id: 'tpl-2', name: 'Drainage ITP' };
      applyItpTemplatesUpdate(queryClient, 'proj-1', true, (prev) => [added, ...prev]);

      expect(queryClient.getQueryData<ItpTemplatesData>(key)).toEqual({
        templates: [added, baseTemplate],
        projectSpecificationSet: 'TfNSW',
      });
    });

    it('is a no-op when the active query has no cached data yet', () => {
      const queryClient = new QueryClient();
      const key = queryKeys.itpTemplates('proj-1', true);

      applyItpTemplatesUpdate(queryClient, 'proj-1', true, (prev) => [baseTemplate, ...prev]);

      expect(queryClient.getQueryData<ItpTemplatesData>(key)).toBeUndefined();
    });

    it('only writes to the matching includeGlobal cache entry', () => {
      const queryClient = new QueryClient();
      const includeGlobalKey = queryKeys.itpTemplates('proj-1', true);
      const excludeGlobalKey = queryKeys.itpTemplates('proj-1', false);
      queryClient.setQueryData<ItpTemplatesData>(includeGlobalKey, {
        templates: [baseTemplate],
        projectSpecificationSet: 'TfNSW',
      });
      queryClient.setQueryData<ItpTemplatesData>(excludeGlobalKey, {
        templates: [baseTemplate],
        projectSpecificationSet: 'TfNSW',
      });

      applyItpTemplatesUpdate(queryClient, 'proj-1', false, () => []);

      expect(queryClient.getQueryData<ItpTemplatesData>(includeGlobalKey)?.templates).toEqual([
        baseTemplate,
      ]);
      expect(queryClient.getQueryData<ItpTemplatesData>(excludeGlobalKey)?.templates).toEqual([]);
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  createTemplateSchema,
  parseOptionalTemplateBooleanQuery,
  parseRequiredTemplateQueryString,
  parseTemplateRouteId,
  propagateTemplateSchema,
  updateTemplateSchema,
} from './templateValidation.js';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const INSTANCE_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_INSTANCE_ID = '33333333-3333-4333-8333-333333333333';

describe('templateValidation', () => {
  it('trims create-template text fields and checklist item fields', () => {
    const result = createTemplateSchema.parse({
      projectId: PROJECT_ID,
      name: '  Earthworks ITP  ',
      description: '  Bulk earthworks  ',
      activityType: '  earthworks  ',
      checklistItems: [
        {
          description: '  Proof roll  ',
          pointType: '  hold_point  ',
          acceptanceCriteria: '  Accepted by superintendent  ',
        },
      ],
    });

    expect(result).toEqual({
      projectId: PROJECT_ID,
      name: 'Earthworks ITP',
      description: 'Bulk earthworks',
      activityType: 'earthworks',
      checklistItems: [
        {
          description: 'Proof roll',
          pointType: 'hold_point',
          acceptanceCriteria: 'Accepted by superintendent',
        },
      ],
    });
  });

  it('preserves nullable optional template fields', () => {
    const result = updateTemplateSchema.parse({
      description: null,
      checklistItems: [{ description: 'Witness compaction', testType: null }],
    });

    expect(result).toEqual({
      description: null,
      checklistItems: [{ description: 'Witness compaction', testType: null }],
    });
  });

  it('rejects blank required template names', () => {
    const result = createTemplateSchema.safeParse({
      projectId: PROJECT_ID,
      name: '   ',
      activityType: 'earthworks',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('name is required');
    }
  });

  it('rejects duplicate propagate instance IDs at the duplicate index', () => {
    const result = propagateTemplateSchema.safeParse({
      instanceIds: [INSTANCE_ID, OTHER_INSTANCE_ID, INSTANCE_ID],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Duplicate instanceIds are not allowed');
      expect(result.error.issues[0]?.path).toEqual(['instanceIds', 2]);
    }
  });

  it('parses required query strings and route IDs with existing error messages', () => {
    expect(parseRequiredTemplateQueryString('  project-1  ', 'projectId')).toBe('project-1');
    expect(parseTemplateRouteId('  template-1  ', 'id')).toBe('template-1');
    expect(() => parseRequiredTemplateQueryString('   ', 'projectId')).toThrow(
      'projectId is required',
    );
    expect(() => parseTemplateRouteId(['template-1'], 'id')).toThrow('id must be a single value');
  });

  it('parses optional boolean query values strictly', () => {
    expect(parseOptionalTemplateBooleanQuery(undefined, 'includeGlobal')).toBeUndefined();
    expect(parseOptionalTemplateBooleanQuery(' true ', 'includeGlobal')).toBe(true);
    expect(parseOptionalTemplateBooleanQuery('false', 'includeGlobal')).toBe(false);
    expect(() => parseOptionalTemplateBooleanQuery('yes', 'includeGlobal')).toThrow(
      'includeGlobal must be true or false',
    );
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildTemplateSnapshot,
  getChecklistItemsForInstance,
  isSubcontractorVisibleChecklistItem,
  resolveChecklistItemForInstance,
} from './templateSnapshot.js';

describe('buildTemplateSnapshot', () => {
  it('captures the template fields and ordered checklist items needed by assigned ITP instances', () => {
    const snapshot = buildTemplateSnapshot({
      id: 'template-1',
      name: 'Earthworks ITP',
      description: 'Template description',
      activityType: 'Earthworks',
      checklistItems: [
        {
          id: 'item-2',
          description: 'Second item',
          sequenceNumber: 2,
          pointType: 'verification',
          responsibleParty: 'subcontractor',
          evidenceRequired: 'photo',
          acceptanceCriteria: 'Accepted',
          testType: null,
        },
        {
          id: 'item-1',
          description: 'First item',
          sequenceNumber: 1,
          pointType: 'hold_point',
          responsibleParty: 'superintendent',
          evidenceRequired: 'none',
          acceptanceCriteria: null,
          testType: 'density',
        },
      ],
    });

    expect(snapshot).toEqual({
      id: 'template-1',
      name: 'Earthworks ITP',
      description: 'Template description',
      activityType: 'Earthworks',
      checklistItems: [
        {
          id: 'item-1',
          description: 'First item',
          sequenceNumber: 1,
          pointType: 'hold_point',
          responsibleParty: 'superintendent',
          evidenceRequired: 'none',
          acceptanceCriteria: null,
          testType: 'density',
        },
        {
          id: 'item-2',
          description: 'Second item',
          sequenceNumber: 2,
          pointType: 'verification',
          responsibleParty: 'subcontractor',
          evidenceRequired: 'photo',
          acceptanceCriteria: 'Accepted',
          testType: null,
        },
      ],
    });
  });
});

describe('getChecklistItemsForInstance', () => {
  it('uses the assigned snapshot instead of the live template when a valid snapshot exists', () => {
    const items = getChecklistItemsForInstance({
      templateSnapshot: JSON.stringify({
        id: 'template-1',
        name: 'Assigned ITP',
        checklistItems: [{ id: 'snapshot-item', description: 'Assigned item', sequenceNumber: 1 }],
      }),
      template: {
        checklistItems: [{ id: 'live-item', description: 'Added later', sequenceNumber: 1 }],
      },
    });

    expect(items.map((item) => item.id)).toEqual(['snapshot-item']);
  });

  it('falls back to the live template when legacy snapshot JSON is malformed', () => {
    const items = getChecklistItemsForInstance({
      templateSnapshot: '{bad json',
      template: {
        checklistItems: [{ id: 'live-item', description: 'Legacy fallback', sequenceNumber: 1 }],
      },
    });

    expect(items.map((item) => item.id)).toEqual(['live-item']);
  });
});

describe('resolveChecklistItemForInstance', () => {
  it('does not resolve live-template items that were added after a valid assignment snapshot', () => {
    const resolved = resolveChecklistItemForInstance(
      {
        templateSnapshot: JSON.stringify({
          id: 'template-1',
          name: 'Assigned ITP',
          checklistItems: [{ id: 'assigned-item', description: 'Assigned', sequenceNumber: 1 }],
        }),
      },
      'live-only-item',
      { id: 'live-only-item', description: 'Added later', sequenceNumber: 2 },
    );

    expect(resolved).toBeNull();
  });

  it('uses the live fallback for legacy instances without a valid snapshot', () => {
    const resolved = resolveChecklistItemForInstance({ templateSnapshot: null }, 'live-item', {
      id: 'live-item',
      description: 'Legacy live item',
      sequenceNumber: 1,
    });

    expect(resolved?.id).toBe('live-item');
  });
});

describe('isSubcontractorVisibleChecklistItem', () => {
  it('allows only contractor, subcontractor, and general items for subcontractor mutation paths', () => {
    expect(isSubcontractorVisibleChecklistItem({ responsibleParty: 'contractor' })).toBe(true);
    expect(isSubcontractorVisibleChecklistItem({ responsibleParty: 'subcontractor' })).toBe(true);
    expect(isSubcontractorVisibleChecklistItem({ responsibleParty: 'general' })).toBe(true);
    expect(isSubcontractorVisibleChecklistItem({ responsibleParty: 'superintendent' })).toBe(false);
    expect(isSubcontractorVisibleChecklistItem({ responsibleParty: 'client' })).toBe(false);
    expect(isSubcontractorVisibleChecklistItem({ responsibleParty: null })).toBe(false);
  });
});

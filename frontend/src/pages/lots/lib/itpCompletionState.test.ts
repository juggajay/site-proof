import { describe, expect, it } from 'vitest';
import { mergeCompletionIntoInstance } from './itpCompletionState';
import type { ITPCompletion, ITPInstance } from '../types';

const existingCompletion: ITPCompletion = {
  id: 'completion-1',
  checklistItemId: 'item-1',
  isCompleted: false,
  isNotApplicable: false,
  isFailed: false,
  notes: null,
  completedAt: null,
  completedBy: null,
  isVerified: false,
  verifiedAt: null,
  verifiedBy: null,
  attachments: [],
};

const instance: ITPInstance = {
  id: 'instance-1',
  template: {
    id: 'template-1',
    name: 'Template',
    checklistItems: [
      {
        id: 'item-1',
        description: 'Existing item',
        category: 'General',
        responsibleParty: 'contractor',
        isHoldPoint: false,
        pointType: 'standard',
        evidenceRequired: 'none',
        order: 1,
      },
      {
        id: 'item-2',
        description: 'New item',
        category: 'General',
        responsibleParty: 'contractor',
        isHoldPoint: false,
        pointType: 'standard',
        evidenceRequired: 'none',
        order: 2,
      },
    ],
  },
  completions: [existingCompletion],
};

describe('mergeCompletionIntoInstance', () => {
  it('replaces an existing completion by checklist item id', () => {
    const updated = {
      ...existingCompletion,
      id: 'completion-updated',
      isCompleted: true,
      notes: 'Done',
    };

    const result = mergeCompletionIntoInstance(instance, updated);

    expect(result?.completions).toEqual([updated]);
    expect(result).not.toBe(instance);
  });

  it('appends a completion for a new checklist item', () => {
    const newCompletion: ITPCompletion = {
      ...existingCompletion,
      id: 'completion-2',
      checklistItemId: 'item-2',
      isCompleted: true,
    };

    const result = mergeCompletionIntoInstance(instance, newCompletion);

    expect(result?.completions).toEqual([existingCompletion, newCompletion]);
  });

  it('preserves null instances', () => {
    expect(mergeCompletionIntoInstance(null, existingCompletion)).toBeNull();
  });
});

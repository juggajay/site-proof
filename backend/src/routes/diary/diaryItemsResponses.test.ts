import { describe, expect, it } from 'vitest';
import {
  buildActivitySuggestionsResponse,
  buildDiaryItemRemovedResponse,
  buildRecentPlantResponse,
} from './diaryItemsResponses.js';

describe('diaryItemsResponses', () => {
  it('builds the recent plant response with the derived count', () => {
    const recentPlant = [
      { description: 'Excavator', idRego: 'EX-001' },
      { description: 'Roller', idRego: 'RL-002' },
    ];

    expect(buildRecentPlantResponse(recentPlant)).toEqual({
      recentPlant,
      count: 2,
    });
  });

  it('builds activity suggestions with visible count and total availability', () => {
    const suggestions = ['Excavate trench', 'Install pipe'];

    expect(buildActivitySuggestionsResponse(suggestions, 8)).toEqual({
      suggestions,
      count: 2,
      totalAvailable: 8,
    });
  });

  it('builds the delivery removed message envelope', () => {
    expect(buildDiaryItemRemovedResponse('Delivery removed')).toEqual({
      message: 'Delivery removed',
    });
  });

  it('builds the event removed message envelope', () => {
    expect(buildDiaryItemRemovedResponse('Event removed')).toEqual({
      message: 'Event removed',
    });
  });
});

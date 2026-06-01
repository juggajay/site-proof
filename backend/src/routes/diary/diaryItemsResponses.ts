export function buildRecentPlantResponse(recentPlant: unknown[]) {
  return {
    recentPlant,
    count: recentPlant.length,
  };
}

export function buildActivitySuggestionsResponse(suggestions: unknown[], totalAvailable: number) {
  return {
    suggestions,
    count: suggestions.length,
    totalAvailable,
  };
}

export function buildDiaryItemRemovedResponse(message: 'Delivery removed' | 'Event removed') {
  return { message };
}

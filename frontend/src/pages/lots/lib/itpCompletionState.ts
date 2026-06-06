import type { ITPCompletion, ITPInstance } from '../types';

export function mergeCompletionIntoInstance(
  instance: ITPInstance | null,
  completion: ITPCompletion,
): ITPInstance | null {
  if (!instance) return instance;

  const existingIndex = instance.completions.findIndex(
    (candidate) => candidate.checklistItemId === completion.checklistItemId,
  );
  const completions = [...instance.completions];
  if (existingIndex >= 0) {
    completions[existingIndex] = completion;
  } else {
    completions.push(completion);
  }

  return { ...instance, completions };
}

import { afterEach, describe, expect, it } from 'vitest';

import {
  NCR_CATEGORIES,
  NCR_ROOT_CAUSE_CATEGORIES,
  NCR_VOCABULARY_NOT_RECORDED,
  NCR_VOCABULARY_OTHER,
  foldNcrCategory,
  foldNcrRootCause,
  isCanonicalNcrCategory,
  isCanonicalNcrRootCause,
  ncrCategoryLabel,
  ncrLearningLoopEnabled,
  ncrRootCauseLabel,
} from './ncrVocabulary.js';

// ---------------------------------------------------------------------------
// PINNED EQUALITY — these literals are duplicated verbatim in the frontend
// mirror's test (`frontend/src/lib/ncrVocabulary.test.ts`). Either module
// drifting from these arrays breaks CI on that side. Update both sides (and any
// UI copy that names a cause) together, on purpose.
// ---------------------------------------------------------------------------

const PINNED_CATEGORIES = [
  { value: 'materials', label: 'Materials' },
  { value: 'workmanship', label: 'Workmanship' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'process', label: 'Process' },
  { value: 'design', label: 'Design' },
  { value: 'other', label: 'Other' },
];

const PINNED_ROOT_CAUSES = [
  { value: 'human_error', label: 'Human Error' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'materials', label: 'Materials' },
  { value: 'process', label: 'Process' },
  { value: 'training', label: 'Training' },
  { value: 'other', label: 'Other' },
];

describe('NCR vocabulary — pinned equality', () => {
  it('carries exactly the six shipped categories, in order', () => {
    expect(NCR_CATEGORIES.map((option) => ({ ...option }))).toEqual(PINNED_CATEGORIES);
  });

  it('carries exactly the six shipped root causes, in order', () => {
    expect(NCR_ROOT_CAUSE_CATEGORIES.map((option) => ({ ...option }))).toEqual(PINNED_ROOT_CAUSES);
  });
});

describe('folding (spec §5.2 gap 1 — never rewrites a stored row)', () => {
  it('keeps a canonical value as itself', () => {
    expect(foldNcrCategory('workmanship')).toBe('workmanship');
    expect(foldNcrRootCause('human_error')).toBe('human_error');
  });

  it('folds free text outside the vocabulary to other', () => {
    expect(foldNcrCategory('Concrete finish (legacy)')).toBe(NCR_VOCABULARY_OTHER);
    expect(foldNcrRootCause('Supervisor said so')).toBe(NCR_VOCABULARY_OTHER);
  });

  it('keeps absent distinct from other', () => {
    expect(foldNcrCategory(null)).toBe(NCR_VOCABULARY_NOT_RECORDED);
    expect(foldNcrCategory('   ')).toBe(NCR_VOCABULARY_NOT_RECORDED);
    expect(foldNcrRootCause(undefined)).toBe(NCR_VOCABULARY_NOT_RECORDED);
    expect(NCR_VOCABULARY_NOT_RECORDED).not.toBe(NCR_VOCABULARY_OTHER);
  });

  it('is case-sensitive — a differently-cased value is not silently canonical', () => {
    expect(foldNcrCategory('Workmanship')).toBe(NCR_VOCABULARY_OTHER);
    expect(isCanonicalNcrCategory('Workmanship')).toBe(false);
    expect(isCanonicalNcrCategory('workmanship')).toBe(true);
    expect(isCanonicalNcrRootCause('training')).toBe(true);
    expect(isCanonicalNcrRootCause('sabotage')).toBe(false);
  });

  it('labels the two fold buckets', () => {
    expect(ncrCategoryLabel(NCR_VOCABULARY_NOT_RECORDED)).toBe('Not recorded');
    expect(ncrCategoryLabel('other')).toBe('Other');
    expect(ncrRootCauseLabel('human_error')).toBe('Human Error');
    expect(ncrRootCauseLabel(NCR_VOCABULARY_NOT_RECORDED)).toBe('Not recorded');
  });
});

describe('NCR_LEARNING_LOOP_ENABLED (spec §5.4)', () => {
  const original = process.env.NCR_LEARNING_LOOP_ENABLED;

  afterEach(() => {
    if (original === undefined) delete process.env.NCR_LEARNING_LOOP_ENABLED;
    else process.env.NCR_LEARNING_LOOP_ENABLED = original;
  });

  it('is OFF when unset — including in production', () => {
    delete process.env.NCR_LEARNING_LOOP_ENABLED;
    expect(ncrLearningLoopEnabled()).toBe(false);
  });

  it('accepts the three truthy tokens and nothing else', () => {
    for (const token of ['true', 'TRUE', ' 1 ', 'yes']) {
      process.env.NCR_LEARNING_LOOP_ENABLED = token;
      expect(ncrLearningLoopEnabled()).toBe(true);
    }
    for (const token of ['false', '0', 'no', 'on', '']) {
      process.env.NCR_LEARNING_LOOP_ENABLED = token;
      expect(ncrLearningLoopEnabled()).toBe(false);
    }
  });
});

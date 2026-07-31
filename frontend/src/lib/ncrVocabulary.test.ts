import { describe, expect, it } from 'vitest';

import {
  NCR_CATEGORIES,
  NCR_ROOT_CAUSE_CATEGORIES,
  NCR_VOCABULARY_NOT_RECORDED,
  NCR_VOCABULARY_OTHER,
  foldNcrCategory,
  foldNcrRootCause,
  isCanonicalNcrCategory,
  ncrCategoryLabel,
  ncrRootCauseLabel,
} from './ncrVocabulary';
import {
  NCR_CATEGORIES as PAGE_CATEGORIES,
  ROOT_CAUSE_CATEGORIES as PAGE_ROOT_CAUSES,
} from '../pages/ncr/constants';

// ---------------------------------------------------------------------------
// PINNED EQUALITY — these literals are duplicated verbatim in the backend
// module's test (`backend/src/lib/ncrVocabulary.test.ts`). Either module
// drifting from these arrays breaks CI on that side.
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

describe('NCR vocabulary mirror — pinned equality', () => {
  it('carries exactly the six shipped categories, in order', () => {
    expect(NCR_CATEGORIES.map((option) => ({ ...option }))).toEqual(PINNED_CATEGORIES);
  });

  it('carries exactly the six shipped root causes, in order', () => {
    expect(NCR_ROOT_CAUSE_CATEGORIES.map((option) => ({ ...option }))).toEqual(PINNED_ROOT_CAUSES);
  });

  it('is the single source the NCR page dropdowns read from', () => {
    expect(PAGE_CATEGORIES.map((option) => ({ ...option }))).toEqual(PINNED_CATEGORIES);
    expect(PAGE_ROOT_CAUSES.map((option) => ({ ...option }))).toEqual(PINNED_ROOT_CAUSES);
  });
});

describe('folding', () => {
  it('keeps canonical, folds free text to other, keeps absent distinct', () => {
    expect(foldNcrCategory('design')).toBe('design');
    expect(foldNcrCategory('Concrete finish (legacy)')).toBe(NCR_VOCABULARY_OTHER);
    expect(foldNcrRootCause(null)).toBe(NCR_VOCABULARY_NOT_RECORDED);
    expect(isCanonicalNcrCategory('Design')).toBe(false);
  });

  it('labels the two fold buckets', () => {
    expect(ncrCategoryLabel(NCR_VOCABULARY_NOT_RECORDED)).toBe('Not recorded');
    expect(ncrRootCauseLabel('human_error')).toBe('Human Error');
  });
});

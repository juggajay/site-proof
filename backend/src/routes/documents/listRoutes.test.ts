import { describe, expect, it } from 'vitest';
import type { Prisma } from '@prisma/client';

import { applyDocumentCategoryFilter, buildDocumentCategoryCounts } from './listRoutes.js';

describe('document list category filters', () => {
  it('maps the Uncategorized category chip to null categories', () => {
    const where: Prisma.DocumentWhereInput = { projectId: 'project-1' };

    applyDocumentCategoryFilter(where, 'uncategorized');

    expect(where.category).toBeNull();
  });

  it('preserves real category values exactly', () => {
    const where: Prisma.DocumentWhereInput = { projectId: 'project-1' };

    applyDocumentCategoryFilter(where, 'quality');

    expect(where.category).toBe('quality');
  });
});

describe('document list category counts', () => {
  it('builds category chips from full result-set group counts', () => {
    expect(
      buildDocumentCategoryCounts([
        { category: 'quality', _count: { _all: 123 } },
        { category: 'design', _count: { _all: 4 } },
        { category: null, _count: { _all: 2 } },
      ]),
    ).toEqual({
      quality: 123,
      design: 4,
      Uncategorized: 2,
    });
  });

  it('ignores empty group counts', () => {
    expect(
      buildDocumentCategoryCounts([
        { category: 'quality', _count: { _all: 0 } },
        { category: 'design', _count: 3 },
      ]),
    ).toEqual({ design: 3 });
  });
});

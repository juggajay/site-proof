import { describe, expect, it } from 'vitest';
import type { Prisma } from '@prisma/client';

import { applyDocumentCategoryFilter } from './listRoutes.js';

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

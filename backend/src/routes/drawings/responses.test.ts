import { afterEach, describe, expect, it } from 'vitest';

import { buildCurrentDrawingSetResponse, buildDrawingListResponse } from './responses.js';

describe('drawing response helpers', () => {
  const originalSupabaseUrl = process.env.SUPABASE_URL;

  afterEach(() => {
    if (originalSupabaseUrl === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = originalSupabaseUrl;
    }
  });

  it('preserves drawing list stats and pagination envelope', () => {
    const drawings = [{ id: 'drawing-1', drawingNumber: 'C-001' }];
    const stats = { total: 26, preliminary: 1, forConstruction: 20, asBuilt: 5 };

    expect(buildDrawingListResponse(drawings, stats, 2, 25)).toEqual({
      drawings,
      stats,
      pagination: {
        total: 26,
        page: 2,
        limit: 25,
        totalPages: 2,
        hasNextPage: false,
        hasPrevPage: true,
      },
    });
  });

  it('normalizes legacy Supabase public URLs in drawing list documents', () => {
    process.env.SUPABASE_URL = 'https://siteproof-test.supabase.co';
    const stats = { total: 1, preliminary: 0, forConstruction: 1, asBuilt: 0 };

    expect(
      buildDrawingListResponse(
        [
          {
            id: 'drawing-1',
            projectId: 'project-1',
            document: {
              id: 'document-1',
              fileUrl:
                'https://siteproof-test.supabase.co/storage/v1/object/public/documents/drawings/project-1/site plan.pdf',
              filename: 'site plan.pdf',
            },
          },
        ],
        stats,
        1,
        25,
      ),
    ).toMatchObject({
      drawings: [
        {
          document: {
            fileUrl: 'supabase://documents/drawings/project-1/site%20plan.pdf',
          },
        },
      ],
    });
  });

  it('preserves current drawing set download metadata and total size', () => {
    expect(
      buildCurrentDrawingSetResponse(
        [
          {
            id: 'drawing-1',
            projectId: 'project-1',
            drawingNumber: 'C-001',
            title: 'Drainage plan',
            revision: 'A',
            status: 'for_construction',
            document: {
              id: 'document-1',
              fileUrl: '/uploads/drawings/c-001.pdf',
              filename: 'c-001.pdf',
              fileSize: 120,
            },
          },
          {
            id: 'drawing-2',
            projectId: 'project-1',
            drawingNumber: 'C-002',
            title: null,
            revision: null,
            status: 'preliminary',
            document: {
              id: 'document-2',
              fileUrl: '/uploads/drawings/c-002.pdf',
              filename: 'c-002.pdf',
              fileSize: null,
            },
          },
        ],
        2,
      ),
    ).toEqual({
      drawings: [
        {
          id: 'drawing-1',
          documentId: 'document-1',
          drawingNumber: 'C-001',
          title: 'Drainage plan',
          revision: 'A',
          status: 'for_construction',
          fileUrl: '/uploads/drawings/c-001.pdf',
          filename: 'c-001.pdf',
          fileSize: 120,
        },
        {
          id: 'drawing-2',
          documentId: 'document-2',
          drawingNumber: 'C-002',
          title: null,
          revision: null,
          status: 'preliminary',
          fileUrl: '/uploads/drawings/c-002.pdf',
          filename: 'c-002.pdf',
          fileSize: null,
        },
      ],
      totalCount: 2,
      totalSize: 120,
    });
  });

  it('normalizes legacy Supabase public URLs in current drawing set responses', () => {
    process.env.SUPABASE_URL = 'https://siteproof-test.supabase.co';

    expect(
      buildCurrentDrawingSetResponse(
        [
          {
            id: 'drawing-1',
            projectId: 'project-1',
            drawingNumber: 'C-001',
            title: 'Drainage plan',
            revision: 'A',
            status: 'for_construction',
            document: {
              id: 'document-1',
              fileUrl:
                'https://siteproof-test.supabase.co/storage/v1/object/public/documents/drawings/project-1/c-001.pdf',
              filename: 'c-001.pdf',
              fileSize: 120,
            },
          },
        ],
        1,
      ),
    ).toMatchObject({
      drawings: [
        {
          documentId: 'document-1',
          fileUrl: 'supabase://documents/drawings/project-1/c-001.pdf',
        },
      ],
      totalSize: 120,
    });
  });
});

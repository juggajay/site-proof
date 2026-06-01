import { describe, expect, it } from 'vitest';

import { buildCurrentDrawingSetResponse, buildDrawingListResponse } from './responses.js';

describe('drawing response helpers', () => {
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

  it('preserves current drawing set download metadata and total size', () => {
    expect(
      buildCurrentDrawingSetResponse(
        [
          {
            id: 'drawing-1',
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
});

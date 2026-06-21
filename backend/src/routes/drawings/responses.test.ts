import { describe, expect, it } from 'vitest';

import {
  buildCurrentDrawingSetResponse,
  buildDrawingListResponse,
  buildDrawingResponse,
} from './responses.js';

describe('drawing response helpers', () => {
  it('strips raw document file URLs from a single drawing response without mutating input', () => {
    const drawing = {
      id: 'drawing-1',
      projectId: 'project-1',
      document: {
        id: 'document-1',
        filename: 'site-plan.pdf',
        fileUrl: 'supabase://documents/drawings/project-1/site-plan.pdf',
      },
    };

    expect(buildDrawingResponse(drawing)).toEqual({
      id: 'drawing-1',
      projectId: 'project-1',
      document: {
        id: 'document-1',
        filename: 'site-plan.pdf',
      },
    });
    expect(drawing.document.fileUrl).toBe('supabase://documents/drawings/project-1/site-plan.pdf');
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

  it('strips raw document file URLs from drawing list documents', () => {
    const stats = { total: 1, preliminary: 0, forConstruction: 1, asBuilt: 0 };
    const drawings = [
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
    ];

    expect(buildDrawingListResponse(drawings, stats, 1, 25)).toMatchObject({
      drawings: [
        {
          document: {
            id: 'document-1',
            filename: 'site plan.pdf',
          },
        },
      ],
    });
    expect(buildDrawingListResponse(drawings, stats, 1, 25).drawings[0]).not.toMatchObject({
      document: { fileUrl: expect.anything() },
    });
    expect(drawings[0].document.fileUrl).toContain('/storage/v1/object/public/');
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
          filename: 'c-002.pdf',
          fileSize: null,
        },
      ],
      totalCount: 2,
      totalSize: 120,
    });
  });

  it('strips raw file URLs from current drawing set responses', () => {
    const fileUrl =
      'https://siteproof-test.supabase.co/storage/v1/object/public/documents/drawings/project-1/c-001.pdf';
    const drawings = [
      {
        id: 'drawing-1',
        projectId: 'project-1',
        drawingNumber: 'C-001',
        title: 'Drainage plan',
        revision: 'A',
        status: 'for_construction',
        document: {
          id: 'document-1',
          fileUrl,
          filename: 'c-001.pdf',
          fileSize: 120,
        },
      },
    ] as unknown as Parameters<typeof buildCurrentDrawingSetResponse>[0];

    expect(buildCurrentDrawingSetResponse(drawings, 1)).toMatchObject({
      drawings: [
        {
          documentId: 'document-1',
          filename: 'c-001.pdf',
        },
      ],
      totalSize: 120,
    });
    expect(buildCurrentDrawingSetResponse(drawings, 1).drawings[0]).not.toHaveProperty('fileUrl');
    expect(fileUrl).toContain('/storage/v1/object/public/');
  });
});

import { getPaginationMeta } from '../../lib/pagination.js';
import { normalizeDocumentFileUrlForResponse } from '../documentResponses.js';

type DrawingStats = {
  total: number;
  preliminary: number;
  forConstruction: number;
  asBuilt: number;
};

type CurrentDrawing = {
  id: string;
  projectId: string;
  drawingNumber: string;
  title: string | null;
  revision: string | null;
  status: string;
  document: {
    id: string;
    fileUrl: string;
    filename: string;
    fileSize: number | null;
  };
};

function normalizeDrawingFileUrl(fileUrl: string, projectId: unknown): string {
  if (typeof projectId !== 'string') {
    return fileUrl;
  }

  const normalized = normalizeDocumentFileUrlForResponse({
    projectId,
    documentType: 'drawing',
    fileUrl,
  });
  return typeof normalized.fileUrl === 'string' ? normalized.fileUrl : fileUrl;
}

function normalizeDrawingDocumentForResponse(drawing: unknown): unknown {
  if (!drawing || typeof drawing !== 'object' || Array.isArray(drawing)) {
    return drawing;
  }

  const record = drawing as Record<string, unknown>;
  const document = record.document;
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    return drawing;
  }

  const documentRecord = document as Record<string, unknown>;
  if (typeof documentRecord.fileUrl !== 'string') {
    return drawing;
  }

  return {
    ...record,
    document: {
      ...documentRecord,
      fileUrl: normalizeDrawingFileUrl(documentRecord.fileUrl, record.projectId),
    },
  };
}

export function buildDrawingListResponse(
  drawings: unknown[],
  stats: DrawingStats,
  page: number,
  limit: number,
) {
  return {
    drawings: drawings.map(normalizeDrawingDocumentForResponse),
    stats,
    pagination: getPaginationMeta(stats.total, page, limit),
  };
}

export function buildCurrentDrawingSetResponse(drawings: CurrentDrawing[], totalCount: number) {
  return {
    drawings: drawings.map((drawing) => ({
      id: drawing.id,
      documentId: drawing.document.id,
      drawingNumber: drawing.drawingNumber,
      title: drawing.title,
      revision: drawing.revision,
      status: drawing.status,
      fileUrl: normalizeDrawingFileUrl(drawing.document.fileUrl, drawing.projectId),
      filename: drawing.document.filename,
      fileSize: drawing.document.fileSize,
    })),
    totalCount,
    totalSize: drawings.reduce((sum, drawing) => sum + (drawing.document.fileSize || 0), 0),
  };
}

import { getPaginationMeta } from '../../lib/pagination.js';

type DrawingStats = {
  total: number;
  preliminary: number;
  forConstruction: number;
  asBuilt: number;
};

type CurrentDrawing = {
  id: string;
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

export function buildDrawingListResponse(
  drawings: unknown[],
  stats: DrawingStats,
  page: number,
  limit: number,
) {
  return {
    drawings,
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
      fileUrl: drawing.document.fileUrl,
      filename: drawing.document.filename,
      fileSize: drawing.document.fileSize,
    })),
    totalCount,
    totalSize: drawings.reduce((sum, drawing) => sum + (drawing.document.fileSize || 0), 0),
  };
}

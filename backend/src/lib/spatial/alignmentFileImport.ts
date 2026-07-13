import { AppError } from '../AppError.js';
import { type AlignmentSummary, summariseAlignment } from './alignmentImport.js';
import { parseDxf } from './dxfParser.js';
import { parseLandXml } from './landxmlParser.js';

export interface AlignmentImportPreview {
  format: 'landxml' | 'dxf';
  alignments: AlignmentSummary[];
  warnings: string[];
}

// 20 MB: comfortably covers a large LandXML/DXF alignment export without letting
// an accidental huge upload buffer in memory.
export const MAX_ALIGNMENT_FILE_BYTES = 20 * 1024 * 1024;

function detectFormat(filename: string, text: string): 'landxml' | 'dxf' {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.dxf')) return 'dxf';
  if (lower.endsWith('.xml') || lower.endsWith('.landxml')) return 'landxml';
  // Unknown extension: sniff. LandXML is angle-bracket markup; DXF is not.
  return text.trimStart().startsWith('<') ? 'landxml' : 'dxf';
}

/** Parse an uploaded LandXML/DXF buffer into per-alignment preview summaries. */
export function parseAlignmentFile(filename: string, buffer: Buffer): AlignmentImportPreview {
  const text = buffer.toString('utf8');
  if (!text.trim()) {
    throw AppError.badRequest('Uploaded file is empty');
  }
  const format = detectFormat(filename, text);
  const result = format === 'landxml' ? parseLandXml(text) : parseDxf(text);
  return {
    format,
    alignments: result.alignments.map(summariseAlignment),
    warnings: result.warnings,
  };
}

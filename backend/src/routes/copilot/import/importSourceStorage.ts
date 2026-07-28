/**
 * Wave B B1 — upload gate and durable storage for an import source file.
 *
 * The source file is persisted as a `Document` with
 * `documentType = 'import_source'` so every imported record traces to the file
 * it came from. That document type is excluded from the client-visible register
 * (§4.11): a contractor migrating 40 ITPs should not find 40 raw spreadsheets in
 * their document register, and a subcontractor should never see them.
 */
import fs from 'node:fs';
import path from 'node:path';

import multer from 'multer';

import { AppError, ErrorCodes } from '../../../lib/AppError.js';
import { assertUploadedFileMatchesDeclaredType } from '../../../lib/imageValidation.js';
import { logError } from '../../../lib/serverLogger.js';
import {
  DOCUMENTS_BUCKET,
  getSupabaseClient,
  getSupabaseStorageReference,
  isSupabaseConfigured,
} from '../../../lib/supabase.js';
import { ensureUploadSubdirectoryAsync } from '../../../lib/uploadPaths.js';
import { buildStoredFilename, getSafeStoredDocumentMimeType } from '../../documents/fileHelpers.js';

// One definition, in the module that owns the register's exclusion list.
export { IMPORT_SOURCE_DOCUMENT_TYPE } from '../../documents/access.js';

const IMPORT_SOURCES_SUBDIR = 'import-sources';

/** §9-D1: 25 MB is what may be STORED and rendered as provenance. The
 *  AI-extraction sub-cap stays at 10 MB — a different limit doing a different
 *  job — and lives with the extraction path, not here. */
export const MAX_IMPORT_UPLOAD_BYTES = 25 * 1024 * 1024;

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
// Macro-enabled Office files are refused by extension AND by MIME type here, and
// again by the vbaProject.bin check in `assertSafeOoxmlArchive`. SiteProof never
// executes macros, so nothing is lost — but accepting them would mean storing
// and re-serving live malware carriers to a contractor's own Windows machines.
// B3 adds Word's macro-enabled extensions beside Excel's, for the same reason.
const MACRO_EXTENSIONS = new Set(['.xlsm', '.xlsb', '.xltm', '.docm', '.dotm']);

/**
 * The accepted source formats, keyed by extension. The extension is
 * client-controlled and only decides which reader runs; the authoritative check
 * that the bytes really are that format is `assertImportUploadContent`.
 */
const SOURCE_FORMAT_BY_EXTENSION = new Map<string, string>([
  ['.xlsx', 'excel'],
  ['.pdf', 'pdf'],
  ['.docx', 'word'],
  // M10: SiteProof's own lot-register export is CSV-only, so refusing `.csv`
  // meant the app could not re-import a register it had just written.
  ['.csv', 'csv'],
]);

/** One wording, used by the multer filter and by the reader that runs after it. */
export const UNSUPPORTED_SOURCE_MESSAGE =
  'Only .xlsx spreadsheets, .csv files, .pdf documents and .docx Word files can be imported.';

const MACRO_REJECTION_MESSAGE =
  'Macro-enabled Office files are not accepted. Save the file as .xlsx or .docx (no macros) and try again.';

export function importSourceFormat(filename: string): string | null {
  return SOURCE_FORMAT_BY_EXTENSION.get(path.extname(filename).toLowerCase()) ?? null;
}

function rejectUpload(message: string): AppError {
  return new AppError(400, message, ErrorCodes.INVALID_FILE_TYPE);
}

export const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMPORT_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (MACRO_EXTENSIONS.has(extension) || file.mimetype.toLowerCase().includes('macroenabled')) {
      cb(rejectUpload(MACRO_REJECTION_MESSAGE));
      return;
    }
    if (!SOURCE_FORMAT_BY_EXTENSION.has(extension)) {
      cb(rejectUpload(UNSUPPORTED_SOURCE_MESSAGE));
      return;
    }
    cb(null, true);
  },
});

/**
 * The authoritative content gate. MIME type and file extension are
 * client-controlled and defence-in-depth only; the magic bytes are the control.
 */
export function assertImportUploadContent(file: Express.Multer.File): void {
  if (!file.buffer || file.buffer.length === 0) {
    throw AppError.badRequest('That file is empty.');
  }
  // A CSV has no magic bytes to check, so `assertUploadedFileMatchesDeclaredType`
  // passes it through unexamined. Text is what it must be: a NUL byte means a
  // binary file wearing a .csv name, and the reader would otherwise turn it into
  // rows of mojibake for the reviewer to puzzle over.
  if (path.extname(file.originalname).toLowerCase() === '.csv' && file.buffer.includes(0)) {
    throw rejectUpload('That file is not readable text. Export it again as CSV.');
  }
  // .xlsx and its MIME type resolve to the 'zip' signature kind, .pdf to 'pdf',
  // so the existing "MIME and extension disagree" guard keeps working unchanged
  // and a renamed .zip/.exe fails on its magic bytes either way.
  assertUploadedFileMatchesDeclaredType(file);
}

/**
 * Persist the raw source file. Supabase when configured (durable); otherwise
 * local disk — production refuses to boot with local storage.
 */
export async function storeImportSource(
  projectId: string,
  batchId: string,
  file: Express.Multer.File,
): Promise<string> {
  const storedName = buildStoredFilename(file.originalname);

  if (isSupabaseConfigured()) {
    const storagePath = `${projectId}/${IMPORT_SOURCES_SUBDIR}/${batchId}/${storedName}`;
    const { error } = await getSupabaseClient()
      .storage.from(DOCUMENTS_BUCKET)
      .upload(storagePath, file.buffer, {
        contentType: getSafeStoredDocumentMimeType(file),
        upsert: false,
      });
    if (error) {
      logError('Supabase import-source upload failed:', error);
      throw new AppError(
        503,
        'File storage is unavailable. Please try again later.',
        ErrorCodes.UPLOAD_FAILED,
      );
    }
    return getSupabaseStorageReference(DOCUMENTS_BUCKET, storagePath);
  }

  // projectId/batchId are server-generated uuids and storedName is sanitized —
  // no user input reaches the path unescaped.
  const dir = await ensureUploadSubdirectoryAsync(
    `${IMPORT_SOURCES_SUBDIR}/${projectId}/${batchId}`,
  );
  await fs.promises.writeFile(path.join(dir, storedName), file.buffer);
  return `uploads/${IMPORT_SOURCES_SUBDIR}/${projectId}/${batchId}/${storedName}`;
}

export { XLSX_MIME };

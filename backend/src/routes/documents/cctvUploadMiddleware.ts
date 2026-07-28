// Wave D `D1d` — the CCTV upload surface's multer wiring, spec §4.8 items 1-2,
// **AT-149**.
//
// Separate from the general document upload (`documents.ts:276-284`) in both
// axes the spec names: a separate MIME allow-set, and a separately-governed size
// ceiling enforced independently of the 50 MB document limit.
//
// It lives in its own module so the enforcement path is testable with a tiny
// `maxBytes` instead of moving 256 MiB through a test.

import multer from 'multer';
import type { RequestHandler } from 'express';

import { AppError, ErrorCodes } from '../../lib/AppError.js';
import {
  CCTV_UPLOAD_MAX_BYTES,
  getCctvFileTooLargeMessage,
  getNormalizedDocumentMimeType,
  getUnsupportedCctvFileTypeMessage,
  isAllowedCctvVideoMimeType,
} from './fileHelpers.js';

/**
 * Build the `upload.single('file')` middleware for `POST /api/documents/upload/cctv`.
 *
 * `maxBytes` is injectable only so a test can prove the ceiling is enforced
 * without allocating one; production always passes the default.
 */
export function createCctvUploadMiddleware(
  storage: multer.StorageEngine,
  maxBytes: number = CCTV_UPLOAD_MAX_BYTES,
): RequestHandler {
  const upload = multer({
    storage,
    limits: { fileSize: maxBytes },
    fileFilter: (_req, file, cb) => {
      if (isAllowedCctvVideoMimeType(getNormalizedDocumentMimeType(file))) {
        cb(null, true);
      } else {
        cb(new Error(getUnsupportedCctvFileTypeMessage(file)));
      }
    },
  }).single('file');

  // The generic handler (`errorHandler.ts:280-290`) turns LIMIT_FILE_SIZE into
  // 413 "Uploaded file is too large", which does not name a ceiling. On this
  // surface the ceiling IS the product decision, so the message states it and
  // the remedy.
  return (req, res, next) =>
    upload(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        next(new AppError(413, getCctvFileTooLargeMessage(maxBytes), ErrorCodes.FILE_TOO_LARGE));
        return;
      }
      next(err);
    });
}

// Wave D `D1d` — **AT-149**. Spec `docs/plans/wave-d-handover-spec-2026-07-28.md`
// §4.8 items 1 and 2.
//
// PROOF-OF-CATCH. The two properties §4.8 makes load-bearing are asserted as
// HTTP outcomes, not as set membership:
//
//   1. the SEPARATION — `video/mp4` is accepted on the CCTV surface and still
//      rejected on the general document surface. A future "just add video to
//      ALLOWED_DOCUMENT_MIME_TYPES" change makes the second assertion fail.
//   2. the CEILING — over-ceiling rejects with a message that names the number
//      and the remedy; under-ceiling passes through to the handler.
//
// The ceiling is exercised at a 1 KiB injected limit rather than 256 MiB: the
// enforcement path (multer `limits.fileSize` -> `MulterError` -> the mapped
// error) is identical, and the production constant is pinned separately below
// and in `lib/handover/loganPsp5Profile.test.ts`.

import express from 'express';
import multer from 'multer';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { AppError } from '../../lib/AppError.js';
import {
  CCTV_DOCUMENT_TYPE,
  CONCEALED_WORKS_DOCUMENT_TYPE,
} from '../../lib/handover/loganPsp5Profile.js';
import { createCctvUploadMiddleware } from './cctvUploadMiddleware.js';
import { assertLotAssociation, LOT_REQUIRED_DOCUMENT_TYPES } from './uploadRoutes.js';
import {
  CCTV_UPLOAD_MAX_BYTES,
  DOCUMENT_UPLOAD_MAX_BYTES,
  getNormalizedDocumentMimeType,
  getUnsupportedDocumentFileTypeMessage,
  isAllowedDocumentMimeType,
} from './fileHelpers.js';

/** The general document upload's multer config, copied from `documents.ts:276-284`. */
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DOCUMENT_UPLOAD_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (isAllowedDocumentMimeType(getNormalizedDocumentMimeType(file))) {
      cb(null, true);
    } else {
      cb(new Error(getUnsupportedDocumentFileTypeMessage(file)));
    }
  },
}).single('file');

function buildApp(maxBytes?: number) {
  const app = express();
  app.post(
    '/upload/cctv',
    createCctvUploadMiddleware(multer.memoryStorage(), maxBytes),
    (req, res) => {
      res.status(201).json({ size: req.file?.size, mimetype: req.file?.mimetype });
    },
  );
  app.post('/upload', documentUpload, (req, res) => {
    res.status(201).json({ size: req.file?.size });
  });
  // Mirrors the shipped shape: AppError -> its own status, anything else -> 400.
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ): void => {
      const status = err instanceof AppError ? err.statusCode : 400;
      res.status(status).json({
        error: {
          message: err instanceof Error ? err.message : 'error',
          code: err instanceof AppError ? err.code : undefined,
        },
      });
    },
  );
  return app;
}

const MP4 = Buffer.from('ftypisom fake mp4 payload');
/** 2 MiB. Small enough to move in a test, large enough to render as "2 MB". */
const TEST_CEILING = 2 * 1024 * 1024;

describe('AT-149 the CCTV upload surface', () => {
  it('accepts video/mp4, which the general document upload still rejects', async () => {
    const app = buildApp();

    const accepted = await request(app)
      .post('/upload/cctv')
      .attach('file', MP4, { filename: 'run-MH12-MH13.mp4', contentType: 'video/mp4' });
    expect(accepted.status).toBe(201);
    expect(accepted.body.mimetype).toBe('video/mp4');

    // The separation is the design (spec §4.8 item 1). Widening
    // ALLOWED_DOCUMENT_MIME_TYPES instead of adding a separate set fails HERE.
    const rejected = await request(app)
      .post('/upload')
      .attach('file', MP4, { filename: 'run-MH12-MH13.mp4', contentType: 'video/mp4' });
    expect(rejected.status).toBe(400);
    expect(rejected.body.error.message).toContain('Invalid file type');
  });

  it('rejects a non-video on the CCTV surface and points at the standard upload', async () => {
    const res = await request(buildApp())
      .post('/upload/cctv')
      .attach('file', Buffer.from('%PDF-1.7'), {
        filename: 'itp.pdf',
        contentType: 'application/pdf',
      });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('accepts video only');
    expect(res.body.error.message).toContain('standard document upload');
  });

  it('admits a video under the ceiling', async () => {
    const res = await request(buildApp(TEST_CEILING))
      .post('/upload/cctv')
      .attach('file', Buffer.alloc(TEST_CEILING - 1024, 1), {
        filename: 'run-under.mp4',
        contentType: 'video/mp4',
      });
    expect(res.status).toBe(201);
    expect(res.body.size).toBe(TEST_CEILING - 1024);
  });

  it('refuses a video over the ceiling, naming the number and the remedy', async () => {
    const res = await request(buildApp(TEST_CEILING))
      .post('/upload/cctv')
      .attach('file', Buffer.alloc(TEST_CEILING + 1024, 1), {
        filename: 'run-over.mp4',
        contentType: 'video/mp4',
      });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('FILE_TOO_LARGE');
    expect(res.body.error.message).toContain('2 MB upload ceiling');
    expect(res.body.error.message).toContain('per-run deliverable');
  });

  it('pins the production ceiling and its independence from the 50 MB document cap', () => {
    expect(CCTV_UPLOAD_MAX_BYTES).toBe(268_435_456); // 256 MiB
    expect(DOCUMENT_UPLOAD_MAX_BYTES).toBe(52_428_800); // 50 MB, unchanged
    // Separately governed, not derived: changing one must not move the other.
    expect(CCTV_UPLOAD_MAX_BYTES % DOCUMENT_UPLOAD_MAX_BYTES).not.toBe(0);
  });
});

// Spec §4.8 item 4. The guard lives on the SHARED body path, not on the CCTV
// route, so the general `/upload` cannot be used to file an unassociated one.
describe('D1d lot association', () => {
  it('names the two handover types the folio resolves per lot', () => {
    expect([...LOT_REQUIRED_DOCUMENT_TYPES].sort()).toEqual(
      [CCTV_DOCUMENT_TYPE, CONCEALED_WORKS_DOCUMENT_TYPE].sort(),
    );
  });

  it('refuses both handover types without a lot, and says why', () => {
    for (const documentType of [CCTV_DOCUMENT_TYPE, CONCEALED_WORKS_DOCUMENT_TYPE]) {
      expect(() => assertLotAssociation(documentType, null)).toThrow(/associated with a lot/);
      expect(() => assertLotAssociation(documentType, undefined)).toThrow(/resolves this evidence/);
      expect(() => assertLotAssociation(documentType, 'lot-1')).not.toThrow();
    }
  });

  it('leaves every other document type alone', () => {
    expect(() => assertLotAssociation('photo', null)).not.toThrow();
    expect(() => assertLotAssociation('om_manual', null)).not.toThrow();
  });
});
